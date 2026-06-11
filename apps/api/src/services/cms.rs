use crate::utils::slug::slugify;

pub fn resolve_slug(title: &str, explicit_slug: Option<&str>) -> String {
    explicit_slug
        .map(str::trim)
        .filter(|slug| !slug.is_empty())
        .map(slugify)
        .unwrap_or_else(|| slugify(title))
}
