use serde_json::json; // Add this to your imports at the top

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

async fn handle_assist(Json(payload): Json<AssistRequest>) -> Json<AssistResponse> {
    // 1. Get the API key from the environment
    let api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return Json(AssistResponse { 
            suggestion: "Error: GEMINI_API_KEY environment variable is not set.".to_string() 
        });
    }

    // 2. Construct the prompt
    let prompt = format!(
        "You are an expert compiler engineer helping a student debug their code. \
        The user is writing a {} file. There is a syntax error on line {}: '{}'. \
        Here is the user's code:\n\n{}\n\n\
        Explain exactly why this error is happening and provide a short, specific code snippet to fix it. \
        Keep the explanation concise and instructional.",
        payload.language, payload.error_line, payload.error_message, payload.code
    );

    // 3. Prepare the request payload for Gemini 1.5 Flash
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

    // 4. Send the request
    match client.post(&url).json(&body).send().await {
        Ok(response) => {
            if response.status().is_success() {
                // Parse Gemini's JSON response
                let resp_json: serde_json::Value = response.json().await.unwrap_or_default();
                
                // Extract the text from the nested JSON structure
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