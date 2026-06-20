use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct PlayerRecord {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub bio: Option<String>,
    pub photo_url: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub nationality: Option<String>,
    pub belt_rank: Option<String>,
    pub weight_class: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct UpsertPlayer {
    pub name: String,
    pub slug: String,
    pub bio: Option<String>,
    pub photo_url: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub nationality: Option<String>,
    pub belt_rank: Option<String>,
    pub weight_class: Option<String>,
    pub is_active: bool,
}

pub async fn find_unique_slug(pool: &PgPool, base_slug: &str) -> Result<String, sqlx::Error> {
    let mut slug = base_slug.to_string();
    let mut counter = 2u32;
    loop {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM players WHERE slug = $1)")
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

pub async fn list_all_players(pool: &PgPool) -> Result<Vec<PlayerRecord>, sqlx::Error> {
    sqlx::query_as::<_, PlayerRecord>(
        r#"
        SELECT id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active, created_at, updated_at
        FROM players
        ORDER BY name ASC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn list_active_players(
    pool: &PgPool,
    per_page: i64,
    offset: i64,
) -> Result<Vec<PlayerRecord>, sqlx::Error> {
    sqlx::query_as::<_, PlayerRecord>(
        r#"
        SELECT id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active, created_at, updated_at
        FROM players
        WHERE is_active = TRUE
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await
}

pub async fn count_active_players(pool: &PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM players WHERE is_active = TRUE")
        .fetch_one(pool)
        .await
}

pub async fn get_player_by_slug(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<PlayerRecord>, sqlx::Error> {
    sqlx::query_as::<_, PlayerRecord>(
        r#"
        SELECT id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active, created_at, updated_at
        FROM players
        WHERE slug = $1 AND is_active = TRUE
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn get_player_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<PlayerRecord>, sqlx::Error> {
    sqlx::query_as::<_, PlayerRecord>(
        r#"
        SELECT id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active, created_at, updated_at
        FROM players
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn create_player(
    pool: &PgPool,
    payload: &UpsertPlayer,
) -> Result<PlayerRecord, sqlx::Error> {
    sqlx::query_as::<_, PlayerRecord>(
        r#"
        INSERT INTO players (id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.bio)
    .bind(&payload.photo_url)
    .bind(payload.date_of_birth)
    .bind(&payload.nationality)
    .bind(&payload.belt_rank)
    .bind(&payload.weight_class)
    .bind(payload.is_active)
    .fetch_one(pool)
    .await
}

pub async fn update_player(
    pool: &PgPool,
    id: Uuid,
    payload: &UpsertPlayer,
) -> Result<Option<PlayerRecord>, sqlx::Error> {
    sqlx::query_as::<_, PlayerRecord>(
        r#"
        UPDATE players
        SET name = $2, slug = $3, bio = $4, photo_url = $5, date_of_birth = $6,
            nationality = $7, belt_rank = $8, weight_class = $9, is_active = $10, updated_at = now()
        WHERE id = $1
        RETURNING id, name, slug, bio, photo_url, date_of_birth, nationality, belt_rank, weight_class, is_active, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.bio)
    .bind(&payload.photo_url)
    .bind(payload.date_of_birth)
    .bind(&payload.nationality)
    .bind(&payload.belt_rank)
    .bind(&payload.weight_class)
    .bind(payload.is_active)
    .fetch_optional(pool)
    .await
}

pub async fn delete_player(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM players WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
