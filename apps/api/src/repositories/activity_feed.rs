use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct FeedRecord {
    pub id: Uuid,
    pub event_type: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub entity_slug: Option<String>,
    pub actor_type: Option<String>,
    pub actor_id: Option<Uuid>,
    pub actor_slug: Option<String>,
    pub title: String,
    pub body: Option<String>,
    pub is_visible: bool,
    pub created_at: DateTime<Utc>,
}

pub struct CreateFeedEvent<'a> {
    pub event_type: &'a str,
    pub entity_type: Option<&'a str>,
    pub entity_id: Option<Uuid>,
    pub entity_slug: Option<&'a str>,
    pub actor_type: Option<&'a str>,
    pub actor_id: Option<Uuid>,
    pub actor_slug: Option<&'a str>,
    pub title: &'a str,
    pub body: Option<&'a str>,
}

pub async fn insert_feed_event(
    pool: &PgPool,
    ev: &CreateFeedEvent<'_>,
) -> Result<FeedRecord, sqlx::Error> {
    sqlx::query_as::<_, FeedRecord>(
        r#"
        INSERT INTO activity_feed
            (id, event_type, entity_type, entity_id, entity_slug,
             actor_type, actor_id, actor_slug, title, body)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, event_type, entity_type, entity_id, entity_slug,
                  actor_type, actor_id, actor_slug, title, body, is_visible, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(ev.event_type)
    .bind(ev.entity_type)
    .bind(ev.entity_id)
    .bind(ev.entity_slug)
    .bind(ev.actor_type)
    .bind(ev.actor_id)
    .bind(ev.actor_slug)
    .bind(ev.title)
    .bind(ev.body)
    .fetch_one(pool)
    .await
}

pub async fn list_feed(
    pool: &PgPool,
    per_page: i64,
    offset: i64,
) -> Result<Vec<FeedRecord>, sqlx::Error> {
    sqlx::query_as::<_, FeedRecord>(
        r#"
        SELECT id, event_type, entity_type, entity_id, entity_slug,
               actor_type, actor_id, actor_slug, title, body, is_visible, created_at
        FROM activity_feed
        WHERE is_visible = TRUE
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await
}

pub async fn count_feed(pool: &PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM activity_feed WHERE is_visible = TRUE")
        .fetch_one(pool)
        .await
}

pub async fn list_feed_for_entity(
    pool: &PgPool,
    entity_type: &str,
    entity_id: Uuid,
    per_page: i64,
    offset: i64,
) -> Result<Vec<FeedRecord>, sqlx::Error> {
    sqlx::query_as::<_, FeedRecord>(
        r#"
        SELECT id, event_type, entity_type, entity_id, entity_slug,
               actor_type, actor_id, actor_slug, title, body, is_visible, created_at
        FROM activity_feed
        WHERE is_visible = TRUE
          AND entity_type = $1 AND entity_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await
}

pub async fn count_feed_for_entity(
    pool: &PgPool,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM activity_feed WHERE is_visible = TRUE AND entity_type = $1 AND entity_id = $2",
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await
}

pub async fn get_feed_by_id(pool: &PgPool, id: Uuid) -> Result<Option<FeedRecord>, sqlx::Error> {
    sqlx::query_as::<_, FeedRecord>(
        r#"
        SELECT id, event_type, entity_type, entity_id, entity_slug,
               actor_type, actor_id, actor_slug, title, body, is_visible, created_at
        FROM activity_feed WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn set_feed_visibility(
    pool: &PgPool,
    id: Uuid,
    is_visible: bool,
) -> Result<Option<FeedRecord>, sqlx::Error> {
    let rows = sqlx::query("UPDATE activity_feed SET is_visible = $2 WHERE id = $1")
        .bind(id)
        .bind(is_visible)
        .execute(pool)
        .await?
        .rows_affected();
    if rows == 0 {
        return Ok(None);
    }
    get_feed_by_id(pool, id).await
}
