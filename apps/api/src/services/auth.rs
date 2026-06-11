use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{SaltString, rand_core::OsRng},
};
use chrono::{Duration, Utc};
use rand::{Rng, distr::Alphanumeric, rng};
use sha2::{Digest, Sha256};

use crate::state::AppState;

#[allow(dead_code)]
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .and_then(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .ok()
        })
        .is_some()
}

pub fn generate_session_token() -> String {
    rng()
        .sample_iter(Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}

pub fn hash_session_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    format!("{digest:x}")
}

pub fn generate_csrf_token() -> String {
    generate_session_token()
}

pub fn session_expiry(state: &AppState) -> chrono::DateTime<Utc> {
    Utc::now() + Duration::hours(state.config.session_ttl_hours)
}

#[cfg(test)]
mod tests {
    use super::{hash_password, verify_password};

    #[test]
    fn hashes_and_verifies_passwords() {
        let hash = hash_password("correct horse battery staple").expect("hash should succeed");
        assert!(verify_password("correct horse battery staple", &hash));
        assert!(!verify_password("wrong password", &hash));
    }
}
