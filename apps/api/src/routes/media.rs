use axum::{
    Extension, Json, Router,
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::{get, patch},
};
use serde::{Deserialize, Serialize};
use std::path::Path as FsPath;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::media::{self, InsertMedia},
    state::AppState,
};

#[derive(Serialize)]
struct ApiEnvelope<T> {
    data: T,
}

#[derive(Deserialize)]
pub struct UpdateMediaPayload {
    alt_text: Option<String>,
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/media", get(list_media).post(upload_media))
        .route("/media/{id}", patch(update_media).delete(delete_media))
}

async fn list_media(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<media::MediaRecord>>>, AppError> {
    let records = media::list_media(&state.db).await?;
    Ok(Json(ApiEnvelope { data: records }))
}

async fn upload_media(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<ApiEnvelope<media::MediaRecord>>), AppError> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
        .ok_or_else(|| AppError::BadRequest("no file field in multipart form".to_string()))?;

    let original_name = field.file_name().unwrap_or("upload").to_string();
    let mime_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();
    let ext = FsPath::new(&original_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let url = format!("/uploads/{filename}");

    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let size_bytes = data.len() as i64;

    if size_bytes > 10 * 1024 * 1024 {
        return Err(AppError::BadRequest("file exceeds 10 MB limit".to_string()));
    }

    let uploads_dir = &state.config.uploads_dir;
    tokio::fs::create_dir_all(uploads_dir).await.map_err(|e| {
        tracing::error!("failed to create uploads dir: {e}");
        AppError::BadRequest("upload directory unavailable".to_string())
    })?;

    let file_path = format!("{uploads_dir}/{filename}");
    let mut file = tokio::fs::File::create(&file_path).await.map_err(|e| {
        tracing::error!("failed to create file {file_path}: {e}");
        AppError::BadRequest("failed to save upload".to_string())
    })?;
    file.write_all(&data).await.map_err(|e| {
        tracing::error!("failed to write file: {e}");
        AppError::BadRequest("failed to write upload".to_string())
    })?;

    let record = media::insert_media(
        &state.db,
        &InsertMedia {
            filename: &filename,
            original_name: &original_name,
            alt_text: None,
            mime_type: &mime_type,
            size_bytes,
            url: &url,
            uploaded_by: user.id,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope { data: record })))
}

async fn update_media(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMediaPayload>,
) -> Result<Json<ApiEnvelope<media::MediaRecord>>, AppError> {
    let record = media::update_media(&state.db, id, payload.alt_text.as_deref())
        .await?
        .ok_or_else(|| AppError::NotFound("media not found".to_string()))?;
    Ok(Json(ApiEnvelope { data: record }))
}

async fn delete_media(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let record = media::delete_media(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("media not found".to_string()))?;

    let file_path = format!("{}/{}", state.config.uploads_dir, record.filename);
    if let Err(e) = tokio::fs::remove_file(&file_path).await {
        tracing::warn!("could not remove file {file_path}: {e}");
    }

    Ok(StatusCode::NO_CONTENT)
}
