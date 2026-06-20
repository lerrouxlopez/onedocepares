use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct RegistrationRecord {
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub tournament_name: String,
    pub tournament_slug: String,
    pub team_id: Uuid,
    pub team_name: String,
    pub team_slug: String,
    pub division_id: Option<Uuid>,
    pub division_name: Option<String>,
    pub status: String,
    pub registered_by: Option<Uuid>,
    pub approved_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

const SELECT_REGISTRATION: &str = r#"
    SELECT r.id,
           r.tournament_id, t.name AS tournament_name, t.slug AS tournament_slug,
           r.team_id, tm.name AS team_name, tm.slug AS team_slug,
           r.division_id, d.name AS division_name,
           r.status, r.registered_by, r.approved_by, r.notes,
           r.created_at, r.updated_at
    FROM tournament_team_registrations r
    JOIN tournaments t  ON t.id  = r.tournament_id
    JOIN teams       tm ON tm.id = r.team_id
    LEFT JOIN tournament_divisions d ON d.id = r.division_id
"#;

pub async fn list_all_registrations(pool: &PgPool) -> Result<Vec<RegistrationRecord>, sqlx::Error> {
    sqlx::query_as::<_, RegistrationRecord>(&format!(
        "{SELECT_REGISTRATION} ORDER BY r.created_at DESC"
    ))
    .fetch_all(pool)
    .await
}

pub async fn list_registrations_for_tournament(
    pool: &PgPool,
    tournament_id: Uuid,
) -> Result<Vec<RegistrationRecord>, sqlx::Error> {
    sqlx::query_as::<_, RegistrationRecord>(&format!(
        "{SELECT_REGISTRATION} WHERE r.tournament_id = $1 ORDER BY r.created_at ASC"
    ))
    .bind(tournament_id)
    .fetch_all(pool)
    .await
}

pub async fn get_registration_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<RegistrationRecord>, sqlx::Error> {
    sqlx::query_as::<_, RegistrationRecord>(&format!("{SELECT_REGISTRATION} WHERE r.id = $1"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_registration(
    pool: &PgPool,
    tournament_id: Uuid,
    team_id: Uuid,
    division_id: Option<Uuid>,
    registered_by: Uuid,
    notes: Option<&str>,
) -> Result<RegistrationRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO tournament_team_registrations
            (id, tournament_id, team_id, division_id, status, registered_by, notes)
        VALUES ($1, $2, $3, $4, 'pending', $5, $6)
        "#,
    )
    .bind(id)
    .bind(tournament_id)
    .bind(team_id)
    .bind(division_id)
    .bind(registered_by)
    .bind(notes)
    .execute(pool)
    .await?;

    get_registration_by_id(pool, id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}

pub async fn update_registration_status(
    pool: &PgPool,
    id: Uuid,
    status: &str,
    approved_by: Option<Uuid>,
) -> Result<Option<RegistrationRecord>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        UPDATE tournament_team_registrations
        SET status = $2, approved_by = COALESCE($3, approved_by), updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(status)
    .bind(approved_by)
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Ok(None);
    }
    get_registration_by_id(pool, id).await
}

pub async fn award_team_points(
    pool: &PgPool,
    team_id: Uuid,
    season: &str,
    points: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO team_stats (id, team_id, season, points)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (team_id, season)
        DO UPDATE SET points = team_stats.points + $4, updated_at = now()
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(team_id)
    .bind(season)
    .bind(points)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn award_player_points(
    pool: &PgPool,
    player_id: Uuid,
    season: &str,
    points: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO player_stats (id, player_id, season, points)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (player_id, season)
        DO UPDATE SET points = player_stats.points + $4, updated_at = now()
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(player_id)
    .bind(season)
    .bind(points)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_rule_points(pool: &PgPool, event_type: &str) -> Result<i32, sqlx::Error> {
    let points: Option<i32> =
        sqlx::query_scalar("SELECT points FROM ranking_rules WHERE event_type = $1")
            .bind(event_type)
            .fetch_optional(pool)
            .await?;
    Ok(points.unwrap_or(0))
}
