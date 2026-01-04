import requests

BASE_URL = "http://localhost:3000"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30

def test_login_with_email_password():
    valid_payload = {
        "email": "admin@demo.com",
        "password": "admin123!",
        "tenantSlug": "cmj753uk40003wug3d36dvlfq"
    }
    invalid_payload = {
        "email": "admin@demo.com",
        "password": "wrongpassword",
        "tenantSlug": "cmj753uk40003wug3d36dvlfq"
    }
    headers = {
        "Content-Type": "application/json"
    }

    # Test with valid credentials
    response = requests.post(
        f"{BASE_URL}{LOGIN_ENDPOINT}",
        json=valid_payload,
        headers=headers,
        timeout=TIMEOUT
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    json_response = response.json()
    assert "token" in json_response or "accessToken" in json_response, "JWT token not found in response"
    assert "user" in json_response, "User data not found in response"
    assert isinstance(json_response["user"], dict), "User data should be a dictionary"

    # Test with invalid credentials
    response_invalid = requests.post(
        f"{BASE_URL}{LOGIN_ENDPOINT}",
        json=invalid_payload,
        headers=headers,
        timeout=TIMEOUT
    )
    assert response_invalid.status_code == 401, f"Expected 401, got {response_invalid.status_code}"

test_login_with_email_password()