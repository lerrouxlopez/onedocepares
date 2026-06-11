use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    routing::{get, patch, post},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::cms::{self, CmsPageRecord, UpsertPage},
    services::cms as cms_service,
    state::AppState,
};


#[derive(Serialize)]
struct ApiEnvelope<T> {
    data: T,
}

#[derive(Deserialize)]
pub struct PagePayload {
    title: String,
    slug: Option<String>,
    body: String,
    excerpt: Option<String>,
    seo_title: Option<String>,
    seo_description: Option<String>,
    status: Option<String>,
}

pub fn public_router() -> Router<AppState> {
    Router::new().route("/cms/pages/{slug}", get(get_public_page))
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/cms/pages", get(list_pages).post(create_page))
        .route("/cms/pages/{id}", patch(update_page))
        .route("/cms/pages/{id}/publish", post(publish_page))
        .route("/cms/pages/{id}/unpublish", post(unpublish_page))
}

async fn get_public_page(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiEnvelope<CmsPageRecord>>, AppError> {
    let page = cms::get_public_page_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("page not found".to_string()))?;

    Ok(Json(ApiEnvelope { data: page }))
}

async fn list_pages(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<CmsPageRecord>>>, AppError> {
    let pages = cms::list_pages(&state.db).await?;
    Ok(Json(ApiEnvelope { data: pages }))
}

async fn create_page(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Json(payload): Json<PagePayload>,
) -> Result<Json<ApiEnvelope<CmsPageRecord>>, AppError> {
    if payload.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".to_string()));
    }

    let slug = cms_service::resolve_slug(&payload.title, payload.slug.as_deref());

    let page = cms::create_page(
        &state.db,
        &UpsertPage {
            title: payload.title,
            slug,
            body: payload.body,
            excerpt: payload.excerpt,
            seo_title: payload.seo_title,
            seo_description: payload.seo_description,
            status: payload.status.unwrap_or_else(|| "draft".to_string()),
            actor_id: user.id,
        },
    )
    .await?;

    Ok(Json(ApiEnvelope { data: page }))
}

async fn update_page(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PagePayload>,
) -> Result<Json<ApiEnvelope<CmsPageRecord>>, AppError> {
    let page = cms::update_page(
        &state.db,
        id,
        &UpsertPage {
            title: payload.title.clone(),
            slug: cms_service::resolve_slug(&payload.title, payload.slug.as_deref()),
            body: payload.body,
            excerpt: payload.excerpt,
            seo_title: payload.seo_title,
            seo_description: payload.seo_description,
            status: payload.status.unwrap_or_else(|| "draft".to_string()),
            actor_id: user.id,
        },
    )
    .await?
    .ok_or_else(|| AppError::NotFound("page not found".to_string()))?;

    Ok(Json(ApiEnvelope { data: page }))
}

async fn publish_page(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiEnvelope<CmsPageRecord>>, AppError> {
    let page = cms::publish_page(&state.db, id, user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("page not found".to_string()))?;

    Ok(Json(ApiEnvelope { data: page }))
}

async fn unpublish_page(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiEnvelope<CmsPageRecord>>, AppError> {
    let page = cms::unpublish_page(&state.db, id, user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("page not found".to_string()))?;

    Ok(Json(ApiEnvelope { data: page }))
}
