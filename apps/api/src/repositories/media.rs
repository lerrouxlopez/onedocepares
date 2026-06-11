use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct MediaRecord {
    pub id: Uuid,
    pub filename: String,
    pub original_name: String,
    pub alt_text: Option<String>,
    pub mime_type: String,
    pub size_bytes: i64,
    pub url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct InsertMedia<'a> {
    pub filename: &'a str,
    pub original_name: &'a str,
    pub alt_text: Option<&'a str>,
    pub mime_type: &'a str,
    pub size_bytes: i64,
    pub url: &'a str,
    pub uploaded_by: Uuid,
}

pub async fn list_media(pool: &PgPool) -> Result<Vec<MediaRecord>, sqlx::Error> {
    sqlx::query_as::<_, MediaRecord>(
        r#"
        SELECT id, filename, original_name, alt_text, mime_type, size_bytes, url, created_at, updated_at
        FROM media
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn insert_media(pool: &PgPool, m: &InsertMedia<'_>) -> Result<MediaRecord, sqlx::Error> {
    sqlx::query_as::<_, MediaRecord>(
        r#"
        INSERT INTO media (id, filename, original_name, alt_text, mime_type, size_bytes, url, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, filename, original_name, alt_text, mime_type, size_bytes, url, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(m.filename)
    .bind(m.original_name)
    .bind(m.alt_text)
    .bind(m.mime_type)
    .bind(m.size_bytes)
    .bind(m.url)
    .bind(m.uploaded_by)
    .fetch_one(pool)
    .await
}

pub async fn get_media_by_id(pool: &PgPool, id: Uuid) -> Result<Option<MediaRecord>, sqlx::Error> {
    sqlx::query_as::<_, MediaRecord>(
        r#"
        SELECT id, filename, original_name, alt_text, mime_type, size_bytes, url, created_at, updated_at
        FROM media
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn update_media(
    pool: &PgPool,
    id: Uuid,
    alt_text: Option<&str>,
) -> Result<Option<MediaRecord>, sqlx::Error> {
    sqlx::query_as::<_, MediaRecord>(
        r#"
        UPDATE media
        SET alt_text = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, filename, original_name, alt_text, mime_type, size_bytes, url, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(alt_text)
    .fetch_optional(pool)
    .await
}

pub async fn delete_media(pool: &PgPool, id: Uuid) -> Result<Option<MediaRecord>, sqlx::Error> {
    sqlx::query_as::<_, MediaRecord>(
        r#"
        DELETE FROM media
        WHERE id = $1
        RETURNING id, filename, original_name, alt_text, mime_type, size_bytes, url, created_at, updated_at
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}
