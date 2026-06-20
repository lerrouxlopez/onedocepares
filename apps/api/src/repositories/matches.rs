use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct MatchRecord {
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub division_id: Option<Uuid>,
    pub round: String,
    pub match_number: i32,
    pub team1_id: Option<Uuid>,
    pub team2_id: Option<Uuid>,
    pub team1_name: Option<String>,
    pub team2_name: Option<String>,
    pub division_name: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct MatchResultRecord {
    pub id: Uuid,
    pub match_id: Uuid,
    pub winner_team_id: Option<Uuid>,
    pub team1_score: Option<i32>,
    pub team2_score: Option<i32>,
    pub notes: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

const SELECT_MATCH: &str = r#"
    SELECT m.id, m.tournament_id, m.division_id, m.round, m.match_number,
           m.team1_id, m.team2_id,
           t1.name AS team1_name, t2.name AS team2_name,
           d.name  AS division_name,
           m.scheduled_at, m.status, m.created_at, m.updated_at
    FROM matches m
    LEFT JOIN teams t1 ON t1.id = m.team1_id
    LEFT JOIN teams t2 ON t2.id = m.team2_id
    LEFT JOIN tournament_divisions d ON d.id = m.division_id
"#;

pub async fn list_matches_for_tournament(
    pool: &PgPool,
    tournament_id: Uuid,
) -> Result<Vec<MatchRecord>, sqlx::Error> {
    sqlx::query_as::<_, MatchRecord>(&format!(
        "{SELECT_MATCH} WHERE m.tournament_id = $1 ORDER BY m.round, m.match_number"
    ))
    .bind(tournament_id)
    .fetch_all(pool)
    .await
}

pub async fn get_match_by_id(pool: &PgPool, id: Uuid) -> Result<Option<MatchRecord>, sqlx::Error> {
    sqlx::query_as::<_, MatchRecord>(&format!("{SELECT_MATCH} WHERE m.id = $1"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

#[allow(clippy::too_many_arguments)]
pub async fn create_match(
    pool: &PgPool,
    tournament_id: Uuid,
    division_id: Option<Uuid>,
    round: &str,
    match_number: i32,
    team1_id: Option<Uuid>,
    team2_id: Option<Uuid>,
    scheduled_at: Option<DateTime<Utc>>,
) -> Result<MatchRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO matches (id, tournament_id, division_id, round, match_number, team1_id, team2_id, scheduled_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(id)
    .bind(tournament_id)
    .bind(division_id)
    .bind(round)
    .bind(match_number)
    .bind(team1_id)
    .bind(team2_id)
    .bind(scheduled_at)
    .execute(pool)
    .await?;

    get_match_by_id(pool, id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_match_status(
    pool: &PgPool,
    id: Uuid,
    status: &str,
) -> Result<Option<MatchRecord>, sqlx::Error> {
    let rows = sqlx::query("UPDATE matches SET status=$2, updated_at=now() WHERE id=$1")
        .bind(id)
        .bind(status)
        .execute(pool)
        .await?
        .rows_affected();

    if rows == 0 {
        return Ok(None);
    }
    get_match_by_id(pool, id).await
}

pub async fn record_match_result(
    pool: &PgPool,
    match_id: Uuid,
    winner_team_id: Option<Uuid>,
    team1_score: Option<i32>,
    team2_score: Option<i32>,
    notes: Option<&str>,
    recorded_by: Uuid,
) -> Result<MatchResultRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO match_results (id, match_id, winner_team_id, team1_score, team2_score, notes, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(id)
    .bind(match_id)
    .bind(winner_team_id)
    .bind(team1_score)
    .bind(team2_score)
    .bind(notes)
    .bind(recorded_by)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, MatchResultRecord>("SELECT * FROM match_results WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn get_match_result(
    pool: &PgPool,
    match_id: Uuid,
) -> Result<Option<MatchResultRecord>, sqlx::Error> {
    sqlx::query_as::<_, MatchResultRecord>("SELECT * FROM match_results WHERE match_id = $1")
        .bind(match_id)
        .fetch_optional(pool)
        .await
}

pub async fn apply_match_stats(
    pool: &PgPool,
    winner_id: Uuid,
    loser_id: Uuid,
    season: &str,
    win_points: i32,
    loss_points: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO team_stats (id, team_id, season, points, wins)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (team_id, season)
        DO UPDATE SET points = team_stats.points + $4, wins = team_stats.wins + 1, updated_at = now()
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(winner_id)
    .bind(season)
    .bind(win_points)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO team_stats (id, team_id, season, points, losses)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (team_id, season)
        DO UPDATE SET points = team_stats.points + $4, losses = team_stats.losses + 1, updated_at = now()
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(loser_id)
    .bind(season)
    .bind(loss_points)
    .execute(pool)
    .await?;

    Ok(())
}
