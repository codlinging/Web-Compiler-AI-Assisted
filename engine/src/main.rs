use axum::{Json, Router, routing::post};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use serde_json::json;
use std::fs;
use std::process::{Command, Stdio};
use std::io::Write;
use engine::{parse_flex, parse_bison, scan_code, Token, ASTNode};

#[derive(Deserialize)]
struct RequestData {
    code: String,
    language: String,
}

#[derive(Deserialize)]
struct AssistRequest {
    code: String,
    language: String,
    error_message: String,
    error_line: usize,
}

#[derive(Serialize)]
struct AssistResponse {
    suggestion: String,
}

#[derive(Serialize)]
struct ResponseData {
    tokens: Vec<Token>,
    ast: ASTNode,
    generated_code: Option<String>,
}

#[derive(Deserialize)]
struct RunRequest {
    c_code: String,
    test_input: String,
}

#[derive(Serialize)]
struct RunResponse {
    output: String,
    error: Option<String>,
}

async fn handle_analyze(Json(payload): Json<RequestData>) -> Json<ResponseData> {
    let tokens = scan_code(&payload.code);
    
    let ast = if payload.language == "bison" {
        parse_bison(&payload.code)
    } else {
        parse_flex(&payload.code)
    };

    let generated_code = if matches!(ast, ASTNode::Error { .. }) {
        None
    } else {
        Some(engine::generate_c_code(&ast))
    };

    Json(ResponseData { tokens, ast, generated_code })
}

async fn handle_assist(Json(payload): Json<AssistRequest>) -> Json<AssistResponse> {
    let api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return Json(AssistResponse {
            suggestion: "Error: GEMINI_API_KEY environment variable is not set.".to_string()
        });
    }

    let prompt = format!(
        "You are an expert compiler engineer. The user is writing a {} file. \
        There is a syntax error on line {}: '{}'. \
        Here is the user's code:\n\n{}\n\n\
        Explain why this error is happening and provide a short snippet to fix it.",
        payload.language, payload.error_line, payload.error_message, payload.code
    );

    let body = json!({
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    });

    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}", 
        api_key
    );

    match client.post(&url).json(&body).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let resp_json: serde_json::Value = response.json().await.unwrap_or_default();
                if let Some(text) = resp_json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                    return Json(AssistResponse { suggestion: text.to_string() });
                }
            }
            Json(AssistResponse { suggestion: "Failed to parse AI response.".to_string() })
        }
        Err(e) => {
            Json(AssistResponse { suggestion: format!("Network Error: {}", e) })
        }
    }
}

// --- PHASE 6: EXECUTION HANDLER ---
async fn handle_run(Json(payload): Json<RunRequest>) -> Json<RunResponse> {
    let file_name = "temp_compiler.c";
    let exe_name = if cfg!(windows) { "temp_compiler.exe" } else { "./temp_compiler.out" };

    if let Err(e) = fs::write(file_name, &payload.c_code) {
        return Json(RunResponse { output: "".into(), error: Some(format!("Failed to write file: {}", e)) });
    }

    let compile_status = Command::new("gcc")
        .arg(file_name)
        .arg("-o")
        .arg(exe_name)
        .output();

    let compile_output = match compile_status {
        Ok(output) => output,
        Err(_) => return Json(RunResponse { output: "".into(), error: Some("GCC not found! Ensure 'gcc' is installed on your system.".to_string()) }),
    };

    if !compile_output.status.success() {
        let stderr = String::from_utf8_lossy(&compile_output.stderr).to_string();
        return Json(RunResponse { output: "".into(), error: Some(format!("Compilation Error:\n{}", stderr)) });
    }

    let mut child = match Command::new(exe_name)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() {
            Ok(child) => child,
            Err(e) => return Json(RunResponse { output: "".into(), error: Some(format!("Failed to run binary: {}", e)) }),
        };

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(payload.test_input.as_bytes()).unwrap_or_default();
    }

    let exec_output = match child.wait_with_output() {
        Ok(output) => output,
        Err(e) => return Json(RunResponse { output: "".into(), error: Some(format!("Execution failed: {}", e)) }),
    };

    let stdout_str = String::from_utf8_lossy(&exec_output.stdout).to_string();
    
    let _ = fs::remove_file(file_name);
    let _ = fs::remove_file(exe_name);

    Json(RunResponse { output: stdout_str, error: None })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/analyze", post(handle_analyze))
        .route("/assist", post(handle_assist))
        .route("/run", post(handle_run)) // Mounted Run Route
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 4000));
    println!("Backend server running at http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}