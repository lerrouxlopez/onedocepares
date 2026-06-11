use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct CmsPageRecord {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub body: String,
    pub excerpt: Option<String>,
    pub seo_title: Option<String>,
    pub seo_description: Option<String>,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpsertPage {
    pub title: String,
    pub slug: String,
    pub body: String,
    pub excerpt: Option<String>,
    pub seo_title: Option<String>,
    pub seo_description: Option<String>,
    pub status: String,
    pub actor_id: Uuid,
}

pub async fn list_pages(pool: &PgPool) -> Result<Vec<CmsPageRecord>, sqlx::Error> {
    sqlx::query_as::<_, CmsPageRecord>(
        r#"
        SELECT id, title, slug, body, excerpt, seo_title, seo_description, status, published_at, created_at, updated_at
        FROM cms_pages
        ORDER BY updated_at DESC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn get_public_page_by_slug(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<CmsPageRecord>, sqlx::Error> {
    sqlx::query_as::<_, CmsPageRecord>(
        r#"
        SELECT id, title, slug, body, excerpt, seo_title, seo_description, status, published_at, created_at, updated_at
        FROM cms_pages
        WHERE slug = $1 AND status = 'published'
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn create_page(
    pool: &PgPool,
    payload: &UpsertPage,
) -> Result<CmsPageRecord, sqlx::Error> {
    sqlx::query_as::<_, CmsPageRecord>(
        r#"
        INSERT INTO cms_pages (
            id, title, slug, body, excerpt, seo_title, seo_description, status, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        RETURNING id, title, slug, body, excerpt, seo_title, seo_description, status, published_at, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.title)
    .bind(&payload.slug)
    .bind(&payload.body)
    .bind(&payload.excerpt)
    .bind(&payload.seo_title)
    .bind(&payload.seo_description)
    .bind(&payload.status)
    .bind(payload.actor_id)
    .fetch_one(pool)
    .await
}

pub async fn update_page(
    pool: &PgPool,
    page_id: Uuid,
    payload: &UpsertPage,
) -> Result<Option<CmsPageRecord>, sqlx::Error> {
    sqlx::query_as::<_, CmsPageRecord>(
        r#"
        UPDATE cms_pages
        SET title = $2,
            slug = $3,
            body = $4,
            excerpt = $5,
            seo_title = $6,
            seo_description = $7,
            status = $8,
            updated_by = $9,
            updated_at = now()
        WHERE id = $1
        RETURNING id, title, slug, body, excerpt, seo_title, seo_description, status, published_at, created_at, updated_at
        "#,
    )
    .bind(page_id)
    .bind(&payload.title)
    .bind(&payload.slug)
    .bind(&payload.body)
    .bind(&payload.excerpt)
    .bind(&payload.seo_title)
    .bind(&payload.seo_description)
    .bind(&payload.status)
    .bind(payload.actor_id)
    .fetch_optional(pool)
    .await
}

pub async fn unpublish_page(
    pool: &PgPool,
    page_id: Uuid,
    actor_id: Uuid,
) -> Result<Option<CmsPageRecord>, sqlx::Error> {
    sqlx::query_as::<_, CmsPageRecord>(
        r#"
        UPDATE cms_pages
        SET status = 'draft',
            updated_by = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING id, title, slug, body, excerpt, seo_title, seo_description, status, published_at, created_at, updated_at
        "#,
    )
    .bind(page_id)
    .bind(actor_id)
    .fetch_optional(pool)
    .await
}

pub async fn publish_page(
    pool: &PgPool,
    page_id: Uuid,
    actor_id: Uuid,
) -> Result<Option<CmsPageRecord>, sqlx::Error> {
    sqlx::query_as::<_, CmsPageRecord>(
        r#"
        UPDATE cms_pages
        SET status = 'published',
            published_at = COALESCE(published_at, now()),
            updated_by = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING id, title, slug, body, excerpt, seo_title, seo_description, status, published_at, created_at, updated_at
        "#,
    )
    .bind(page_id)
    .bind(actor_id)
    .fetch_optional(pool)
    .await
}
