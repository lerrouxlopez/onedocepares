use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct BadgeRecord {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub category: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct PlayerBadgeRecord {
    pub id: Uuid,
    pub player_id: Uuid,
    pub badge_id: Uuid,
    pub badge_name: String,
    pub badge_slug: String,
    pub badge_description: Option<String>,
    pub badge_icon_url: Option<String>,
    pub badge_category: String,
    pub awarded_at: DateTime<Utc>,
    pub awarded_by: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct TeamBadgeRecord {
    pub id: Uuid,
    pub team_id: Uuid,
    pub badge_id: Uuid,
    pub badge_name: String,
    pub badge_slug: String,
    pub badge_description: Option<String>,
    pub badge_icon_url: Option<String>,
    pub badge_category: String,
    pub awarded_at: DateTime<Utc>,
    pub awarded_by: Option<Uuid>,
    pub notes: Option<String>,
}

const SELECT_PLAYER_BADGE: &str = r#"
    SELECT pb.id, pb.player_id, pb.badge_id,
           b.name AS badge_name, b.slug AS badge_slug,
           b.description AS badge_description, b.icon_url AS badge_icon_url,
           b.category AS badge_category,
           pb.awarded_at, pb.awarded_by, pb.notes
    FROM player_badges pb
    JOIN badges b ON b.id = pb.badge_id
"#;

const SELECT_TEAM_BADGE: &str = r#"
    SELECT tb.id, tb.team_id, tb.badge_id,
           b.name AS badge_name, b.slug AS badge_slug,
           b.description AS badge_description, b.icon_url AS badge_icon_url,
           b.category AS badge_category,
           tb.awarded_at, tb.awarded_by, tb.notes
    FROM team_badges tb
    JOIN badges b ON b.id = tb.badge_id
"#;

// ─── Badge definitions ───────────────────────────────────────────────────────

pub async fn list_badges(pool: &PgPool) -> Result<Vec<BadgeRecord>, sqlx::Error> {
    sqlx::query_as::<_, BadgeRecord>("SELECT * FROM badges ORDER BY category, name")
        .fetch_all(pool)
        .await
}

pub async fn get_badge_by_id(pool: &PgPool, id: Uuid) -> Result<Option<BadgeRecord>, sqlx::Error> {
    sqlx::query_as::<_, BadgeRecord>("SELECT * FROM badges WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_badge(
    pool: &PgPool,
    name: &str,
    slug: &str,
    description: Option<&str>,
    icon_url: Option<&str>,
    category: &str,
) -> Result<BadgeRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO badges (id, name, slug, description, icon_url, category) VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(id)
    .bind(name)
    .bind(slug)
    .bind(description)
    .bind(icon_url)
    .bind(category)
    .execute(pool)
    .await?;

    get_badge_by_id(pool, id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_badge(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    slug: &str,
    description: Option<&str>,
    icon_url: Option<&str>,
    category: &str,
) -> Result<Option<BadgeRecord>, sqlx::Error> {
    let rows = sqlx::query(
        "UPDATE badges SET name=$2,slug=$3,description=$4,icon_url=$5,category=$6,updated_at=now() WHERE id=$1",
    )
    .bind(id)
    .bind(name)
    .bind(slug)
    .bind(description)
    .bind(icon_url)
    .bind(category)
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Ok(None);
    }
    get_badge_by_id(pool, id).await
}

pub async fn delete_badge(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query("DELETE FROM badges WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}

// ─── Player badges ───────────────────────────────────────────────────────────

pub async fn get_badges_for_player(
    pool: &PgPool,
    player_id: Uuid,
) -> Result<Vec<PlayerBadgeRecord>, sqlx::Error> {
    sqlx::query_as::<_, PlayerBadgeRecord>(&format!(
        "{SELECT_PLAYER_BADGE} WHERE pb.player_id = $1 ORDER BY pb.awarded_at DESC"
    ))
    .bind(player_id)
    .fetch_all(pool)
    .await
}

pub async fn award_badge_to_player(
    pool: &PgPool,
    player_id: Uuid,
    badge_id: Uuid,
    awarded_by: Uuid,
    notes: Option<&str>,
) -> Result<PlayerBadgeRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO player_badges (id, player_id, badge_id, awarded_by, notes) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(player_id)
    .bind(badge_id)
    .bind(awarded_by)
    .bind(notes)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, PlayerBadgeRecord>(&format!("{SELECT_PLAYER_BADGE} WHERE pb.id = $1"))
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn revoke_player_badge(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query("DELETE FROM player_badges WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}

// ─── Team badges ─────────────────────────────────────────────────────────────

pub async fn get_badges_for_team(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Vec<TeamBadgeRecord>, sqlx::Error> {
    sqlx::query_as::<_, TeamBadgeRecord>(&format!(
        "{SELECT_TEAM_BADGE} WHERE tb.team_id = $1 ORDER BY tb.awarded_at DESC"
    ))
    .bind(team_id)
    .fetch_all(pool)
    .await
}

pub async fn award_badge_to_team(
    pool: &PgPool,
    team_id: Uuid,
    badge_id: Uuid,
    awarded_by: Uuid,
    notes: Option<&str>,
) -> Result<TeamBadgeRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO team_badges (id, team_id, badge_id, awarded_by, notes) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(team_id)
    .bind(badge_id)
    .bind(awarded_by)
    .bind(notes)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, TeamBadgeRecord>(&format!("{SELECT_TEAM_BADGE} WHERE tb.id = $1"))
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn revoke_team_badge(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query("DELETE FROM team_badges WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}
