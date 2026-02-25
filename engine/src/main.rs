use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

use engine::{parse_flex, parse_bison, scan_code, Token, ASTNode};

#[derive(Deserialize)]
struct RequestData {
    code: String,
    language: String, // "flex" or "bison"
}

#[derive(Serialize)]
struct ResponseData {
    tokens: Vec<Token>,
    ast: ASTNode,
}

async fn handle_analyze(Json(payload): Json<RequestData>) -> Json<ResponseData> {
    let tokens = scan_code(&payload.code);
    
    // Dynamically choose the parser based on the request!
    let ast = if payload.language == "bison" {
        parse_bison(&payload.code)
    } else {
        parse_flex(&payload.code)
    };

    Json(ResponseData { tokens, ast })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/analyze", post(handle_analyze))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 4000));
    println!("Backend server running at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}