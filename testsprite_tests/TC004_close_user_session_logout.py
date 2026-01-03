import requests

BASE_URL = "http://localhost:3000"
LOGOUT_ENDPOINT = "/api/auth/logout"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWo3NTN1d28wMDBod3VnM2diN3gya2V1IiwidGVuYW50SWQiOiJjbWo3NTN1azQwMDAzd3VnM2QzNmR2bGZxIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGVJZCI6ImNtajc1M3VrODAwMDV3dWczemFpZDV4eXMiLCJwZXJtaXNzaW9ucyI6WyIqIl0sImJyYW5jaElkIjoiY21qNzUzdWtmMDAwYnd1ZzNkcmc0M2N3cyIsImlhdCI6MTc2NjMyNjc5MywiZXhwIjoxNzY2OTMxNTkzfQ.C-LUk0oIlX9_GzhUB8bAdZO-QFZKJXTdv5ZjognsyWs"


def test_close_user_session_logout():
    url = BASE_URL + LOGOUT_ENDPOINT
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json"
    }
    try:
        response = requests.post(url, headers=headers, timeout=30)
        # Assert HTTP 200 status code for successful logout
        assert response.status_code == 200, f"Expected 200, got {response.status_code}; Response body: {response.text}"

    except requests.RequestException as e:
        assert False, f"Request to logout endpoint failed: {e}"


test_close_user_session_logout()