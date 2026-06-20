use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct TeamRecord {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub founded_year: Option<i32>,
    pub website: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct UpsertTeam {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub founded_year: Option<i32>,
    pub website: Option<String>,
    pub is_active: bool,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct TeamMemberRecord {
    pub id: Uuid,
    pub team_id: Uuid,
    pub player_id: Uuid,
    pub player_name: String,
    pub player_slug: String,
    pub is_captain: bool,
    pub joined_at: Option<NaiveDate>,
    pub left_at: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

pub async fn find_unique_slug(pool: &PgPool, base_slug: &str) -> Result<String, sqlx::Error> {
    let mut slug = base_slug.to_string();
    let mut counter = 2u32;
    loop {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM teams WHERE slug = $1)")
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

pub async fn list_all_teams(pool: &PgPool) -> Result<Vec<TeamRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamRecord>(
        r#"
        SELECT id, name, slug, description, logo_url, city, country, founded_year, website, is_active, created_at, updated_at
        FROM teams
        ORDER BY name ASC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn list_active_teams(
    pool: &PgPool,
    per_page: i64,
    offset: i64,
) -> Result<Vec<TeamRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamRecord>(
        r#"
        SELECT id, name, slug, description, logo_url, city, country, founded_year, website, is_active, created_at, updated_at
        FROM teams
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

pub async fn count_active_teams(pool: &PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM teams WHERE is_active = TRUE")
        .fetch_one(pool)
        .await
}

pub async fn get_team_by_slug(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<TeamRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamRecord>(
        r#"
        SELECT id, name, slug, description, logo_url, city, country, founded_year, website, is_active, created_at, updated_at
        FROM teams
        WHERE slug = $1 AND is_active = TRUE
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn get_team_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TeamRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamRecord>(
        r#"
        SELECT id, name, slug, description, logo_url, city, country, founded_year, website, is_active, created_at, updated_at
        FROM teams
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn create_team(pool: &PgPool, payload: &UpsertTeam) -> Result<TeamRecord, sqlx::Error> {
    sqlx::query_as::<_, TeamRecord>(
        r#"
        INSERT INTO teams (id, name, slug, description, logo_url, city, country, founded_year, website, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, name, slug, description, logo_url, city, country, founded_year, website, is_active, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.description)
    .bind(&payload.logo_url)
    .bind(&payload.city)
    .bind(&payload.country)
    .bind(payload.founded_year)
    .bind(&payload.website)
    .bind(payload.is_active)
    .fetch_one(pool)
    .await
}

pub async fn update_team(
    pool: &PgPool,
    id: Uuid,
    payload: &UpsertTeam,
) -> Result<Option<TeamRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamRecord>(
        r#"
        UPDATE teams
        SET name = $2, slug = $3, description = $4, logo_url = $5, city = $6, country = $7,
            founded_year = $8, website = $9, is_active = $10, updated_at = now()
        WHERE id = $1
        RETURNING id, name, slug, description, logo_url, city, country, founded_year, website, is_active, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.slug)
    .bind(&payload.description)
    .bind(&payload.logo_url)
    .bind(&payload.city)
    .bind(&payload.country)
    .bind(payload.founded_year)
    .bind(&payload.website)
    .bind(payload.is_active)
    .fetch_optional(pool)
    .await
}

pub async fn delete_team(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM teams WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_team_members(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Vec<TeamMemberRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamMemberRecord>(
        r#"
        SELECT tm.id, tm.team_id, tm.player_id,
               p.name AS player_name, p.slug AS player_slug,
               tm.is_captain, tm.joined_at, tm.left_at, tm.created_at
        FROM team_members tm
        JOIN players p ON p.id = tm.player_id
        WHERE tm.team_id = $1
        ORDER BY tm.is_captain DESC, p.name ASC
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await
}

pub async fn add_team_member(
    pool: &PgPool,
    team_id: Uuid,
    player_id: Uuid,
    is_captain: bool,
    joined_at: Option<NaiveDate>,
) -> Result<TeamMemberRecord, sqlx::Error> {
    sqlx::query_as::<_, TeamMemberRecord>(
        r#"
        WITH inserted AS (
            INSERT INTO team_members (id, team_id, player_id, is_captain, joined_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, team_id, player_id, is_captain, joined_at, left_at, created_at
        )
        SELECT i.id, i.team_id, i.player_id,
               p.name AS player_name, p.slug AS player_slug,
               i.is_captain, i.joined_at, i.left_at, i.created_at
        FROM inserted i
        JOIN players p ON p.id = i.player_id
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(team_id)
    .bind(player_id)
    .bind(is_captain)
    .bind(joined_at)
    .fetch_one(pool)
    .await
}

pub async fn remove_team_member(
    pool: &PgPool,
    team_id: Uuid,
    player_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM team_members WHERE team_id = $1 AND player_id = $2")
        .bind(team_id)
        .bind(player_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
