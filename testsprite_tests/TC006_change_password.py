import requests

BASE_URL = "http://localhost:3000"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWo3NTN1d28wMDBod3VnM2diN3gya2V1IiwidGVuYW50SWQiOiJjbWo3NTN1azQwMDAzd3VnM2QzNmR2bGZxIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGVJZCI6ImNtajc1M3VrODAwMDV3dWczemFpZDV4eXMiLCJwZXJtaXNzaW9ucyI6WyIqIl0sImJyYW5jaElkIjoiY21qNzUzdWtmMDAwYnd1ZzNkcmc0M2N3cyIsImlhdCI6MTc2NjMyNjc5MywiZXhwIjoxNzY2OTMxNTkzfQ.C-LUk0oIlX9_GzhUB8bAdZO-QFZKJXTdv5ZjognsyWs"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_change_password():
    url = f"{BASE_URL}/api/auth/password"
    # Assuming the current password is known and valid
    current_password = "CurrentPass123"
    new_password = "NewPassw0rd!"

    payload = {
        "currentPassword": current_password,
        "newPassword": new_password
    }

    try:
        response = requests.put(url, json=payload, headers=HEADERS, timeout=30)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        # Optionally check response content if defined, here we just check status
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_change_password()