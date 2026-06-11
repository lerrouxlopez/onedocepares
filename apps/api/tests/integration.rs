/// Integration tests — require a live PostgreSQL database.
/// Set TEST_DATABASE_URL to run them:
///   TEST_DATABASE_URL=postgres://... cargo test
/// Tests are silently skipped when TEST_DATABASE_URL is unset.
use api::{app::build_router_with_state, config::Config, services::auth::hash_password, state::AppState};
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;
use uuid::Uuid;

// ─── helpers ─────────────────────────────────────────────────────────────────

struct Ctx {
    state: AppState,
    app: Router,
}

async fn setup() -> Option<Ctx> {
    let _ = dotenvy::dotenv();
    let url = std::env::var("TEST_DATABASE_URL").ok()?;

    let config = Config {
        bind_addr: "127.0.0.1:0".parse().unwrap(),
        database_url: url.clone(),
        rust_log: "error".to_string(),
        session_cookie_name: "odp_session".to_string(),
        secure_cookies: false,
        session_ttl_hours: 24,
        uploads_dir: "./test_uploads".to_string(),
    };

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .ok()?;

    sqlx::migrate!("./migrations").run(&pool).await.ok()?;

    let state = AppState::new(config, pool);
    let app = build_router_with_state(state.clone());
    Some(Ctx { state, app })
}

async fn create_admin(ctx: &Ctx, email: &str, password: &str) -> Uuid {
    let hash = hash_password(password).unwrap();
    let user_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(user_id)
    .bind(email)
    .bind("Test Admin")
    .bind(&hash)
    .execute(&ctx.state.db)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = 'admin'",
    )
    .bind(user_id)
    .execute(&ctx.state.db)
    .await
    .unwrap();

    user_id
}

async fn cleanup_user(ctx: &Ctx, email: &str) {
    let _ = sqlx::query(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    )
    .bind(email)
    .execute(&ctx.state.db)
    .await;

    let _ = sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(email)
        .execute(&ctx.state.db)
        .await;
}

async fn cleanup_page(ctx: &Ctx, slug: &str) {
    let _ = sqlx::query("DELETE FROM cms_pages WHERE slug = $1")
        .bind(slug)
        .execute(&ctx.state.db)
        .await;
}

async fn body_json(resp: axum::response::Response) -> Value {
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

/// Log in and return (cookie_header, csrf_token).
async fn login(app: &Router, email: &str, password: &str) -> (String, String) {
    let resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({"email": email, "password": password}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK, "login should succeed");

    let cookie = resp
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Fetch CSRF token using the session cookie.
    let csrf_resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/auth/csrf")
                .header("Cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = body_json(csrf_resp).await;
    let csrf = json["data"]["csrf_token"].as_str().unwrap().to_string();

    (cookie, csrf)
}

// ─── auth tests ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_login_valid_credentials() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_valid@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({"email": email, "password": "Pass1234!"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    assert!(resp.headers().contains_key("set-cookie"));
    let json = body_json(resp).await;
    assert_eq!(json["data"]["email"], email);
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_login_wrong_password() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_wrong@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({"email": email, "password": "wrong"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_me_requires_session() {
    let Some(ctx) = setup().await else { return };

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/auth/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_me_returns_user_with_session() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_me@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, _) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/auth/me")
                .header("Cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp).await;
    assert_eq!(json["data"]["email"], email);
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_logout_revokes_session() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_logout@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/logout")
                .header("Cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    // Old cookie should no longer work.
    let resp2 = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/auth/me")
                .header("Cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp2.status(), StatusCode::UNAUTHORIZED);
    cleanup_user(&ctx, &email).await;
}

// ─── CSRF tests ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_csrf_required_for_mutation() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_csrf@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, _) = login(&ctx.app, &email, "Pass1234!").await;

    // POST to an admin endpoint without CSRF header.
    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/admin/cms/pages")
                .header("Cookie", &cookie)
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({"title": "No CSRF", "body": "<p>test</p>"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_csrf_wrong_token_rejected() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_csrfbad@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, _) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/admin/cms/pages")
                .header("Cookie", &cookie)
                .header("x-csrf-token", "not-the-right-token")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({"title": "Bad CSRF", "body": "<p>test</p>"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_admin_endpoint_requires_admin_role() {
    let Some(ctx) = setup().await else { return };

    // Create a regular (non-admin) user.
    let email = format!("t_{}_nonadmin@test.com", Uuid::new_v4().simple());
    let hash = hash_password("Pass1234!").unwrap();
    sqlx::query(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(&email)
    .bind("Non Admin")
    .bind(&hash)
    .execute(&ctx.state.db)
    .await
    .unwrap();

    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/admin/cms/pages")
                .header("Cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    cleanup_user(&ctx, &email).await;
}

// ─── CMS tests ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_create_and_publish_page() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_cms@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let slug = format!("test-page-{}", Uuid::new_v4().simple());

    // Create draft page.
    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/admin/cms/pages")
                .header("Cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "title": "Test Page",
                        "slug": slug,
                        "body": "<p>Hello world</p>"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp).await;
    let page_id = json["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(json["data"]["status"], "draft");

    // Draft page should NOT be publicly visible.
    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/cms/pages/{slug}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);

    // Publish.
    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/admin/cms/pages/{page_id}/publish"))
                .header("Cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp).await;
    assert_eq!(json["data"]["status"], "published");

    // Published page should now be publicly visible.
    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/cms/pages/{slug}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp).await;
    assert_eq!(json["data"]["slug"], slug);

    // Unpublish.
    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/admin/cms/pages/{page_id}/unpublish"))
                .header("Cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp).await;
    assert_eq!(json["data"]["status"], "draft");

    cleanup_page(&ctx, &slug).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_list_pages_requires_admin() {
    let Some(ctx) = setup().await else { return };

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/admin/cms/pages")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
