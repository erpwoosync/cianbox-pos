import requests

def test_refresh_access_token():
    base_url = "http://localhost:3000"
    endpoint = "/api/auth/refresh"
    url = base_url + endpoint

    headers = {
        "Content-Type": "application/json"
    }

    payload = {
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWo3NTN1d28wMDBod3VnM2diN3gya2V1IiwidGVuYW50SWQiOiJjbWo3NTN1azQwMDAzd3VnM2QzNmR2bGZxIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGVJZCI6ImNtajc1M3VrODAwMDV3dWczemFpZDV4eXMiLCJwZXJtaXNzaW9ucyI6WyIqIl0sImJyYW5jaElkIjoiY21qNzUzdWtmMDAwYnd1ZzNkcmc0M2N3cyIsImlhdCI6MTc2NjMyNjc5MywiZXhwIjoxNzY2OTMxNTkzfQ.C-LUk0oIlX9_GzhUB8bAdZO-QFZKJXTdv5ZjognsyWs"
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        json_resp = response.json()
        token = json_resp.get("accessToken") or json_resp.get("token") or json_resp.get("access_token")
        assert token and isinstance(token, str) and len(token) > 10, "New access token not found in response"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_refresh_access_token()
