use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct TournamentRecord {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub registration_open_at: Option<DateTime<Utc>>,
    pub registration_close_at: Option<DateTime<Utc>>,
    pub status: String,
    pub max_teams: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct UpsertTournament {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub registration_open_at: Option<DateTime<Utc>>,
    pub registration_close_at: Option<DateTime<Utc>>,
    pub status: String,
    pub max_teams: Option<i32>,
    pub actor_id: Uuid,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct TournamentDivisionRecord {
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub max_participants: Option<i32>,
    pub created_at: DateTime<Utc>,
}

pub async fn find_unique_slug(pool: &PgPool, base_slug: &str) -> Result<String, sqlx::Error> {
    let mut slug = base_slug.to_string();
    let mut counter = 2u32;
    loop {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tournaments WHERE slug = $1)")
                .bind(&slug)
                .fetch_one(pool)
                .await?;
        if !exists {
            return Ok(slug);
        }
        slug = format!("{}-{}", base_slug, counter);
        counter += 1;
    }
}

pub async fn list_all_tournaments(pool: &PgPool) -> Result<Vec<TournamentRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        SELECT id, name, slug, description, location, start_date, end_date,
               registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        FROM tournaments
        ORDER BY start_date DESC NULLS LAST, created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn list_public_tournaments(
    pool: &PgPool,
    per_page: i64,
    offset: i64,
) -> Result<Vec<TournamentRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        SELECT id, name, slug, description, location, start_date, end_date,
               registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        FROM tournaments
        WHERE status != 'cancelled'
        ORDER BY start_date ASC NULLS LAST, created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await
}

pub async fn count_public_tournaments(pool: &PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM tournaments WHERE status != 'cancelled'")
        .fetch_one(pool)
        .await
}

pub async fn get_tournament_by_slug(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<TournamentRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        SELECT id, name, slug, description, location, start_date, end_date,
               registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        FROM tournaments
        WHERE slug = $1
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn get_tournament_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TournamentRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        SELECT id, name, slug, description, location, start_date, end_date,
               registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        FROM tournaments
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn create_tournament(
    pool: &PgPool,
    payload: &UpsertTournament,
) -> Result<TournamentRecord, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        INSERT INTO tournaments (
            id, name, slug, description, location, start_date, end_date,
            registration_open_at, registration_close_at, status, max_teams, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        RETURNING id, name, slug, description, location, start_date, end_date,
                  registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.description)
    .bind(&payload.location)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(payload.registration_open_at)
    .bind(payload.registration_close_at)
    .bind(&payload.status)
    .bind(payload.max_teams)
    .bind(payload.actor_id)
    .fetch_one(pool)
    .await
}

pub async fn update_tournament(
    pool: &PgPool,
    id: Uuid,
    payload: &UpsertTournament,
) -> Result<Option<TournamentRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        UPDATE tournaments
        SET name = $2, slug = $3, description = $4, location = $5,
            start_date = $6, end_date = $7, registration_open_at = $8,
            registration_close_at = $9, status = $10, max_teams = $11,
            updated_by = $12, updated_at = now()
        WHERE id = $1
        RETURNING id, name, slug, description, location, start_date, end_date,
                  registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.description)
    .bind(&payload.location)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(payload.registration_open_at)
    .bind(payload.registration_close_at)
    .bind(&payload.status)
    .bind(payload.max_teams)
    .bind(payload.actor_id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_tournament(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM tournaments WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_divisions(
    pool: &PgPool,
    tournament_id: Uuid,
) -> Result<Vec<TournamentDivisionRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentDivisionRecord>(
        r#"
        SELECT id, tournament_id, name, description, max_participants, created_at
        FROM tournament_divisions
        WHERE tournament_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(tournament_id)
    .fetch_all(pool)
    .await
}

pub async fn create_division(
    pool: &PgPool,
    tournament_id: Uuid,
    name: &str,
    description: Option<&str>,
    max_participants: Option<i32>,
) -> Result<TournamentDivisionRecord, sqlx::Error> {
    sqlx::query_as::<_, TournamentDivisionRecord>(
        r#"
        INSERT INTO tournament_divisions (id, tournament_id, name, description, max_participants)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, tournament_id, name, description, max_participants, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(tournament_id)
    .bind(name)
    .bind(description)
    .bind(max_participants)
    .fetch_one(pool)
    .await
}

pub async fn list_upcoming_tournaments(
    pool: &PgPool,
) -> Result<Vec<TournamentRecord>, sqlx::Error> {
    sqlx::query_as::<_, TournamentRecord>(
        r#"
        SELECT id, name, slug, description, location, start_date, end_date,
               registration_open_at, registration_close_at, status, max_teams, created_at, updated_at
        FROM tournaments
        WHERE status NOT IN ('cancelled', 'completed')
          AND (start_date IS NULL OR start_date >= CURRENT_DATE)
        ORDER BY start_date ASC NULLS LAST
        LIMIT 100
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn delete_division(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM tournament_divisions WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
