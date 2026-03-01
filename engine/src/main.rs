use axum::{Json, Router, routing::{Route, post}};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use serde_json::json;
use engine::{parse_flex, parse_bison,scan_code,Token,ASTNode};
#[derive(Deserialize)]
struct RequestData{
    code:String,
    language:String,
}
#[derive(Deserialize)]
struct AssistRequest{
    code:String,
    language:String,
    error_message:String,
    error_line:usize,
}
#[derive(Serialize)]
struct AssistResponse{
    suggestion:String,
}
#[derive(Serialize)]
struct ResponseData{
    tokens:Vec<Token>,
    ast:ASTNode,
}
async fn handle_analyze(Json(payload):Json<RequestData>)->Json<ResponseData>{
    let tokens=scan_code(&payload.code);
    let ast =if payload.language=="bison"{
        parse_bison(&payload.code)
}else{
    parse_flex(&payload.code)
};
Json(ResponseData{tokens,ast})
}
async fn handle_assist(Json(payload):Json<AssistRequest>)->Json<AssistResponse>{
    let api_key=std::env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty(){
        return Json(AssistResponse{
            suggestion:"Error key not found".to_string()
        });
    }
    let prompt=format!(
        "You are an expert compiler engineer. The user is writing a {} file. \
        There is a syntax error on line {}: '{}'. \
        Here is the user's code:\n\n{}\n\n\
        Explain why this error is happening and provide a short snippet to fix it.",
        payload.language,payload.error_line,payload.error_message,payload.code
    );
    let body =json!({
        "contents":[{
            "parts":[{"text":prompt}]
        }]

    });
    let client=reqwest::Client::new();
    let url=format!{
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}", 
        api_key
    };
    match client.post(&url).json(&body).send().await{
        Ok(response)=>{
            if response.status().is_success(){
                let resp_json:serde_json::Value=response.json().await.unwrap_or_default();
                if let Some(text)=resp_json["candidate"][0]["content"]["parts"][0]["text"].as_str(){
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
#[tokio::main]
async fn main(){
    let app=Router::new()
    .route("/analyze",post(handle_analyze))
    .route("/assist",post(handle_assist))
    .layer(CorsLayer::permissive());
let addr=SocketAddr::from(([127,0,0,1],4000));
println!("Backend server running at http://{}",addr);
let listener=tokio::net::TcpListener::bind(addr).await.unwrap();
axum::serve(listener,app).await.unwrap();

}