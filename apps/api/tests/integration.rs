/// Integration tests — require a live PostgreSQL database.
/// Set TEST_DATABASE_URL to run them:
///   TEST_DATABASE_URL=postgres://... cargo test
/// Tests are silently skipped when TEST_DATABASE_URL is unset.
use api::{
    app::build_router_with_state, config::Config, services::auth::hash_password, state::AppState,
};
use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
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
        smtp_host: None,
        smtp_port: 587,
        smtp_username: None,
        smtp_password: None,
        smtp_from: "no-reply@onedocepares.com".to_string(),
        superadmin_email: None,
        superadmin_password: None,
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

// ─── Phase 2 helpers ─────────────────────────────────────────────────────────

async fn create_user(ctx: &Ctx, email: &str, password: &str) -> Uuid {
    let hash = hash_password(password).unwrap();
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(email)
    .bind("Test User")
    .bind(&hash)
    .execute(&ctx.state.db)
    .await
    .unwrap();
    id
}

async fn cleanup_team(ctx: &Ctx, id: Uuid) {
    let _ = sqlx::query("DELETE FROM teams WHERE id = $1")
        .bind(id)
        .execute(&ctx.state.db)
        .await;
}

async fn cleanup_player(ctx: &Ctx, id: Uuid) {
    let _ = sqlx::query("DELETE FROM players WHERE id = $1")
        .bind(id)
        .execute(&ctx.state.db)
        .await;
}

async fn cleanup_tournament(ctx: &Ctx, id: Uuid) {
    let _ = sqlx::query("DELETE FROM tournaments WHERE id = $1")
        .bind(id)
        .execute(&ctx.state.db)
        .await;
}

async fn admin_post(
    app: &Router,
    uri: &str,
    cookie: &str,
    csrf: &str,
    body: serde_json::Value,
) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("Cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn admin_patch(
    app: &Router,
    uri: &str,
    cookie: &str,
    csrf: &str,
    body: serde_json::Value,
) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(uri)
                .header("Cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn admin_delete(
    app: &Router,
    uri: &str,
    cookie: &str,
    csrf: &str,
) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(uri)
                .header("Cookie", cookie)
                .header("x-csrf-token", csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn get_public(app: &Router, uri: &str) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(uri)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn authed_get(app: &Router, uri: &str, cookie: &str) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(uri)
                .header("Cookie", cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2: Teams
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_team_admin_requires_auth() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/admin/teams").await;
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/admin/teams")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "Ghost Team"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_team_crud() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_teamcrud@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    // Create.
    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/teams",
        &cookie,
        &csrf,
        json!({"name": "Test Warriors", "city": "Manila", "country": "PH"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = body_json(resp).await;
    let team_id: Uuid = body["data"]["id"].as_str().unwrap().parse().unwrap();
    let slug = body["data"]["slug"].as_str().unwrap().to_string();
    assert!(!slug.is_empty());

    // Admin list includes it.
    let resp = authed_get(&ctx.app, "/api/v1/admin/teams", &cookie).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let list = body_json(resp).await;
    assert!(
        list["data"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["id"] == team_id.to_string())
    );

    // Public read by slug.
    let resp = get_public(&ctx.app, &format!("/api/v1/teams/{slug}")).await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"]["name"], "Test Warriors");

    // Public list has pagination.
    let resp = get_public(&ctx.app, "/api/v1/teams").await;
    assert_eq!(resp.status(), StatusCode::OK);
    let list = body_json(resp).await;
    assert!(list["pagination"].is_object());

    // Update.
    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/teams/{team_id}"),
        &cookie,
        &csrf,
        json!({"name": "Test Warriors Updated", "city": "Cebu"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert_eq!(body["data"]["name"], "Test Warriors Updated");
    assert_eq!(body["data"]["city"], "Cebu");

    // Delete.
    let resp = admin_delete(
        &ctx.app,
        &format!("/api/v1/admin/teams/{team_id}"),
        &cookie,
        &csrf,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let resp = get_public(&ctx.app, &format!("/api/v1/teams/{slug}")).await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);

    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_team_not_found() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/teams/this-team-does-not-exist").await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_team_member_management() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_members@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/teams",
        &cookie,
        &csrf,
        json!({"name": "Member Test Team"}),
    )
    .await;
    let team_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/players",
        &cookie,
        &csrf,
        json!({"name": "Member Player", "belt_rank": "blue"}),
    )
    .await;
    let player_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    // Add player to team.
    let resp = admin_post(
        &ctx.app,
        &format!("/api/v1/admin/teams/{team_id}/members"),
        &cookie,
        &csrf,
        json!({"player_id": player_id, "is_captain": false}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::CREATED);

    // List members.
    let resp = authed_get(
        &ctx.app,
        &format!("/api/v1/admin/teams/{team_id}/members"),
        &cookie,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    let members = body["data"].as_array().unwrap();
    assert_eq!(members.len(), 1);
    assert_eq!(members[0]["player_id"], player_id.to_string());

    // Remove member.
    let resp = admin_delete(
        &ctx.app,
        &format!("/api/v1/admin/teams/{team_id}/members/{player_id}"),
        &cookie,
        &csrf,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    // Now empty.
    let resp = authed_get(
        &ctx.app,
        &format!("/api/v1/admin/teams/{team_id}/members"),
        &cookie,
    )
    .await;
    let body = body_json(resp).await;
    assert_eq!(body["data"].as_array().unwrap().len(), 0);

    cleanup_team(&ctx, team_id).await;
    cleanup_player(&ctx, player_id).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_non_admin_cannot_create_team() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_teamnonadmin@test.com", Uuid::new_v4().simple());
    create_user(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/teams",
        &cookie,
        &csrf,
        json!({"name": "Sneaky Team"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    cleanup_user(&ctx, &email).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2: Players
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_player_admin_requires_auth() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/admin/players").await;
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_player_crud() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_playercrud@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    // Create.
    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/players",
        &cookie,
        &csrf,
        json!({"name": "Test Fighter", "belt_rank": "black", "nationality": "PH"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = body_json(resp).await;
    let player_id: Uuid = body["data"]["id"].as_str().unwrap().parse().unwrap();
    let slug = body["data"]["slug"].as_str().unwrap().to_string();
    assert_eq!(body["data"]["belt_rank"], "black");

    // Public read by slug.
    let resp = get_public(&ctx.app, &format!("/api/v1/players/{slug}")).await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"]["name"], "Test Fighter");

    // Public list.
    let resp = get_public(&ctx.app, "/api/v1/players").await;
    assert_eq!(resp.status(), StatusCode::OK);
    let list = body_json(resp).await;
    assert!(
        list["data"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["id"] == player_id.to_string())
    );

    // Update.
    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/players/{player_id}"),
        &cookie,
        &csrf,
        json!({"name": "Test Fighter Updated", "belt_rank": "brown"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert_eq!(body["data"]["name"], "Test Fighter Updated");
    assert_eq!(body["data"]["belt_rank"], "brown");

    // Delete.
    let resp = admin_delete(
        &ctx.app,
        &format!("/api/v1/admin/players/{player_id}"),
        &cookie,
        &csrf,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let resp = get_public(&ctx.app, &format!("/api/v1/players/{slug}")).await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);

    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_player_not_found() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/players/this-player-does-not-exist").await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2: Tournaments
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_tournament_admin_requires_auth() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/admin/tournaments").await;
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_tournament_crud() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_tcrud@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    // Create.
    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/tournaments",
        &cookie,
        &csrf,
        json!({"name": "Integration Cup", "location": "Manila", "status": "upcoming"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = body_json(resp).await;
    let tournament_id: Uuid = body["data"]["id"].as_str().unwrap().parse().unwrap();
    let slug = body["data"]["slug"].as_str().unwrap().to_string();
    assert_eq!(body["data"]["status"], "upcoming");

    // Public read by slug.
    let resp = get_public(&ctx.app, &format!("/api/v1/tournaments/{slug}")).await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"]["name"], "Integration Cup");

    // Public list.
    let resp = get_public(&ctx.app, "/api/v1/tournaments").await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert!(body_json(resp).await["pagination"].is_object());

    // Update.
    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/tournaments/{tournament_id}"),
        &cookie,
        &csrf,
        json!({"name": "Integration Cup", "status": "active"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"]["status"], "active");

    // Delete.
    let resp = admin_delete(
        &ctx.app,
        &format!("/api/v1/admin/tournaments/{tournament_id}"),
        &cookie,
        &csrf,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let resp = get_public(&ctx.app, &format!("/api/v1/tournaments/{slug}")).await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);

    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_tournament_not_found() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/tournaments/no-such-tournament-xyzzy").await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_tournament_division_management() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_divs@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/tournaments",
        &cookie,
        &csrf,
        json!({"name": "Division Test Cup"}),
    )
    .await;
    let tournament_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    // Add division.
    let resp = admin_post(
        &ctx.app,
        &format!("/api/v1/admin/tournaments/{tournament_id}/divisions"),
        &cookie,
        &csrf,
        json!({"name": "Open Lightweight", "max_participants": 16}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let div_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    // List divisions.
    let resp = authed_get(
        &ctx.app,
        &format!("/api/v1/admin/tournaments/{tournament_id}/divisions"),
        &cookie,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"].as_array().unwrap().len(), 1);

    // Delete division.
    let resp = admin_delete(
        &ctx.app,
        &format!("/api/v1/admin/tournaments/{tournament_id}/divisions/{div_id}"),
        &cookie,
        &csrf,
    )
    .await;
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let resp = authed_get(
        &ctx.app,
        &format!("/api/v1/admin/tournaments/{tournament_id}/divisions"),
        &cookie,
    )
    .await;
    assert_eq!(body_json(resp).await["data"].as_array().unwrap().len(), 0);

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_user(&ctx, &email).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: Registrations
// ═══════════════════════════════════════════════════════════════════════════════

async fn setup_tournament_and_team(
    ctx: &Ctx,
    cookie: &str,
    csrf: &str,
    suffix: &str,
) -> (Uuid, String, Uuid) {
    let t_resp = admin_post(
        &ctx.app,
        "/api/v1/admin/tournaments",
        cookie,
        csrf,
        json!({"name": format!("Reg Test Cup {suffix}"), "status": "upcoming"}),
    )
    .await;
    assert_eq!(t_resp.status(), StatusCode::CREATED);
    let t_body = body_json(t_resp).await;
    let tournament_id: Uuid = t_body["data"]["id"].as_str().unwrap().parse().unwrap();
    let tournament_slug = t_body["data"]["slug"].as_str().unwrap().to_string();

    let team_resp = admin_post(
        &ctx.app,
        "/api/v1/admin/teams",
        cookie,
        csrf,
        json!({"name": format!("Reg Team {suffix}")}),
    )
    .await;
    assert_eq!(team_resp.status(), StatusCode::CREATED);
    let team_id: Uuid = body_json(team_resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    (tournament_id, tournament_slug, team_id)
}

async fn register_team_request(
    ctx: &Ctx,
    tournament_slug: &str,
    cookie: &str,
    csrf: &str,
    team_id: Uuid,
) -> axum::response::Response {
    ctx.app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/tournaments/{tournament_slug}/register-team"
                ))
                .header("Cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"team_id": team_id}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap()
}

#[tokio::test]
async fn test_register_team_requires_auth() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_regauth@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &cookie, &csrf, "auth").await;

    let resp = ctx
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/tournaments/{slug}/register-team"))
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"team_id": team_id}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_registration_submit_and_approve() {
    let Some(ctx) = setup().await else { return };
    let admin_email = format!("t_{}_regadmin@test.com", Uuid::new_v4().simple());
    let user_email = format!("t_{}_reguser@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &admin_email, "Pass1234!").await;
    create_user(&ctx, &user_email, "Pass1234!").await;
    let (admin_cookie, admin_csrf) = login(&ctx.app, &admin_email, "Pass1234!").await;
    let (user_cookie, user_csrf) = login(&ctx.app, &user_email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &admin_cookie, &admin_csrf, "approve").await;

    // Non-admin user may register a team.
    let resp = register_team_request(&ctx, &slug, &user_cookie, &user_csrf, team_id).await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = body_json(resp).await;
    let reg_id: Uuid = body["data"]["id"].as_str().unwrap().parse().unwrap();
    assert_eq!(body["data"]["status"], "pending");

    // Admin list includes it.
    let resp = authed_get(&ctx.app, "/api/v1/admin/registrations", &admin_cookie).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let list = body_json(resp).await;
    assert!(
        list["data"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["id"] == reg_id.to_string())
    );

    // Admin approves.
    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/registrations/{reg_id}"),
        &admin_cookie,
        &admin_csrf,
        json!({"status": "approved"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"]["status"], "approved");

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &admin_email).await;
    cleanup_user(&ctx, &user_email).await;
}

#[tokio::test]
async fn test_registration_reject() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_regreject@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &cookie, &csrf, "reject").await;

    let resp = register_team_request(&ctx, &slug, &cookie, &csrf, team_id).await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let reg_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/registrations/{reg_id}"),
        &cookie,
        &csrf,
        json!({"status": "rejected"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["data"]["status"], "rejected");

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_registration_full_workflow() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_regfull@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &cookie, &csrf, "full").await;

    let resp = register_team_request(&ctx, &slug, &cookie, &csrf, team_id).await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let reg_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    for (status, expected) in [
        ("approved", "approved"),
        ("checked_in", "checked_in"),
        ("completed", "completed"),
    ] {
        let resp = admin_patch(
            &ctx.app,
            &format!("/api/v1/admin/registrations/{reg_id}"),
            &cookie,
            &csrf,
            json!({"status": status}),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK, "PATCH to {status} failed");
        assert_eq!(body_json(resp).await["data"]["status"], expected);
    }

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_duplicate_registration_rejected() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_dupreguser@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &cookie, &csrf, "dup").await;

    // First registration succeeds.
    let resp = register_team_request(&ctx, &slug, &cookie, &csrf, team_id).await;
    assert_eq!(resp.status(), StatusCode::CREATED);

    // Second registration for the same team + tournament is rejected.
    let resp = register_team_request(&ctx, &slug, &cookie, &csrf, team_id).await;
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_registration_admin_action_requires_admin() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_regperm@test.com", Uuid::new_v4().simple());
    create_user(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/registrations/{}", Uuid::new_v4()),
        &cookie,
        &csrf,
        json!({"status": "approved"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_invalid_registration_status_rejected() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_regstatus@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &cookie, &csrf, "status").await;

    let resp = register_team_request(&ctx, &slug, &cookie, &csrf, team_id).await;
    let reg_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/registrations/{reg_id}"),
        &cookie,
        &csrf,
        json!({"status": "flying"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &email).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: Leaderboards
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_leaderboard_public_endpoints_return_ok() {
    let Some(ctx) = setup().await else { return };

    for uri in ["/api/v1/leaderboards/players", "/api/v1/leaderboards/teams"] {
        let resp = get_public(&ctx.app, uri).await;
        assert_eq!(resp.status(), StatusCode::OK, "GET {uri} failed");
        assert!(body_json(resp).await["data"].is_array());
    }
}

#[tokio::test]
async fn test_leaderboard_rebuild_requires_admin() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_lbperm@test.com", Uuid::new_v4().simple());
    create_user(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/leaderboards/rebuild",
        &cookie,
        &csrf,
        json!({}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_leaderboard_rebuild_creates_snapshots() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_lbrebuild@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/leaderboards/rebuild",
        &cookie,
        &csrf,
        json!({}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert!(
        body["data"]["team_snapshot_id"].as_str().is_some(),
        "missing team_snapshot_id"
    );
    assert!(
        body["data"]["player_snapshot_id"].as_str().is_some(),
        "missing player_snapshot_id"
    );

    // Public boards available after rebuild.
    for uri in ["/api/v1/leaderboards/players", "/api/v1/leaderboards/teams"] {
        let resp = get_public(&ctx.app, uri).await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert!(body_json(resp).await["data"].is_array());
    }

    cleanup_user(&ctx, &email).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: Activity feed
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_feed_public_endpoint() {
    let Some(ctx) = setup().await else { return };
    let resp = get_public(&ctx.app, "/api/v1/feed").await;
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert!(body["data"].is_array());
    assert!(body["pagination"].is_object());
}

#[tokio::test]
async fn test_feed_generated_on_registration_approval() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_feedgen@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    let (tournament_id, slug, team_id) =
        setup_tournament_and_team(&ctx, &cookie, &csrf, "feedgen").await;

    let resp = register_team_request(&ctx, &slug, &cookie, &csrf, team_id).await;
    assert_eq!(resp.status(), StatusCode::CREATED);
    let reg_id: Uuid = body_json(resp).await["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/registrations/{reg_id}"),
        &cookie,
        &csrf,
        json!({"status": "approved"}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);

    // Feed should contain the approval event.
    let resp = get_public(&ctx.app, "/api/v1/feed").await;
    let body = body_json(resp).await;
    let items = body["data"].as_array().unwrap();
    assert!(
        items
            .iter()
            .any(|i| i["event_type"].as_str() == Some("registration_approved")),
        "expected registration_approved feed event"
    );

    cleanup_tournament(&ctx, tournament_id).await;
    cleanup_team(&ctx, team_id).await;
    cleanup_user(&ctx, &email).await;
}

#[tokio::test]
async fn test_feed_moderation_hide_and_show() {
    let Some(ctx) = setup().await else { return };
    let email = format!("t_{}_feedmod@test.com", Uuid::new_v4().simple());
    create_admin(&ctx, &email, "Pass1234!").await;
    let (cookie, csrf) = login(&ctx.app, &email, "Pass1234!").await;

    // Ensure at least one feed item exists via a leaderboard rebuild.
    let resp = admin_post(
        &ctx.app,
        "/api/v1/admin/leaderboards/rebuild",
        &cookie,
        &csrf,
        json!({}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);

    let resp = get_public(&ctx.app, "/api/v1/feed").await;
    let body = body_json(resp).await;
    let items = body["data"].as_array().unwrap();
    assert!(!items.is_empty(), "feed must have at least one item");
    let feed_id = items[0]["id"].as_str().unwrap().to_string();
    let was_visible = items[0]["is_visible"].as_bool().unwrap_or(true);

    // Toggle off.
    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/feed/{feed_id}"),
        &cookie,
        &csrf,
        json!({"is_visible": !was_visible}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        body_json(resp).await["data"]["is_visible"]
            .as_bool()
            .unwrap(),
        !was_visible
    );

    // Restore.
    let resp = admin_patch(
        &ctx.app,
        &format!("/api/v1/admin/feed/{feed_id}"),
        &cookie,
        &csrf,
        json!({"is_visible": was_visible}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        body_json(resp).await["data"]["is_visible"]
            .as_bool()
            .unwrap(),
        was_visible
    );

    cleanup_user(&ctx, &email).await;
}
