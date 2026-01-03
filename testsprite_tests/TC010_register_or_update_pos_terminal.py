import requests

BASE_URL = "http://localhost:3000"
REGISTER_ENDPOINT = "/api/pos/terminals/register"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWo3NTN1d28wMDBod3VnM2diN3gya2V1IiwidGVuYW50SWQiOiJjbWo3NTN1azQwMDAzd3VnM2QzNmR2bGZxIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGVJZCI6ImNtajc1M3VrODAwMDV3dWczemFpZDV4eXMiLCJwZXJtaXNzaW9ucyI6WyIqIl0sImJyYW5jaElkIjoiY21qNzUzdWtmMDAwYnd1ZzNkcmc0M2N3cyIsImlhdCI6MTc2NjMyNjc5MywiZXhwIjoxNzY2OTMxNTkzfQ.C-LUk0oIlX9_GzhUB8bAdZO-QFZKJXTdv5ZjognsyWs"
HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json",
}

def test_register_or_update_pos_terminal():
    url = BASE_URL + REGISTER_ENDPOINT
    # Test data for active terminal (should return 200)
    payload_active = {
        "hostname": "test-active-host",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "osVersion": "10.0.1",
        "appVersion": "2.3.4",
        "ipAddress": "192.168.1.100"
    }
    # Test data for pending or blocked terminal (should return 403)
    # We simulate this by registering with a MAC known to be in pending/blocked status,
    # but since no data on that exists, we will try to register then patch status to PENDING and retry.
    # To do that, we must first register a terminal, then update it status to PENDING or BLOCKED by
    # fetching its ID, then test register again. But the instructions don't specify such workflow.
    # So with only current endpoint, test 200 and 403 response by assuming a MAC format difference for 403.
    # However, the PRD shows no such control on input; 403 means the terminal is pending/blocked,
    # so possibly we'd simulate with different MACs or repeated register calls.

    # Since we don't have terminal IDs here, we will:
    # 1. Register a new terminal (active scenario) and assert status 200.
    # 2. Attempt to register a terminal with the same hostname/MAC but forcibly patch terminal to BLOCKED with a follow-up request.
    #    Then re-register to expect 403.
    # But PATCH /api/pos/terminals/{id} requires terminal id, so we need to create terminal first,
    # get its id from a listing or response, patch status to BLOCKED, then test register status.

    # So implement the following:
    # 1. Register terminal => 200 (active)
    # 2. Get terminal id by listing terminals and matching hostname/macAddress
    # 3. Patch terminal status to BLOCKED
    # 4. Call register with same hostname/macAddress => expect 403

    # Since no endpoint for listing terminals is in instruction, but PRD shows GET /api/pos/terminals, available,
    # So we use it here.

    TERMINALS_LIST_ENDPOINT = "/api/pos/terminals"
    PATCH_TERMINAL_ENDPOINT = "/api/pos/terminals/{id}"

    try:
        # Register terminal first time (active)
        resp = requests.post(url, json=payload_active, headers=HEADERS, timeout=30)
        assert resp.status_code == 200, f"Expected 200 for active terminal registration, got {resp.status_code}"
        data = resp.json()
        # Confirm response shape if possible
        assert isinstance(data, dict), "Response body should be a JSON object"

        # Get list of terminals to find the registered terminal id
        resp_list = requests.get(BASE_URL + TERMINALS_LIST_ENDPOINT, headers=HEADERS, timeout=30)
        assert resp_list.status_code == 200, f"Expected 200 from terminal list, got {resp_list.status_code}"
        terminals = resp_list.json()
        assert isinstance(terminals, list), "Terminals list should be a JSON array"

        terminal_id = None
        for t in terminals:
            if (
                t.get("hostname") == payload_active["hostname"] and
                t.get("macAddress") and t.get("macAddress").lower() == payload_active["macAddress"].lower()
            ):
                terminal_id = t.get("id")
                break

        assert terminal_id, "Registered terminal not found in terminals list"

        # Patch terminal to BLOCKED status
        patch_url = BASE_URL + PATCH_TERMINAL_ENDPOINT.format(id=terminal_id)
        patch_payload = {"status": "BLOCKED"}
        resp_patch = requests.patch(patch_url, json=patch_payload, headers=HEADERS, timeout=30)
        assert resp_patch.status_code == 200, f"Expected 200 on patching terminal status, got {resp_patch.status_code}"

        # Try registering again with same hostname and macAddress, expect 403 since terminal is blocked
        resp_blocked = requests.post(url, json=payload_active, headers=HEADERS, timeout=30)
        assert resp_blocked.status_code == 403, f"Expected 403 for blocked terminal registration, got {resp_blocked.status_code}"

    finally:
        # Cleanup: delete the registered terminal
        if 'terminal_id' in locals() and terminal_id:
            delete_url = BASE_URL + PATCH_TERMINAL_ENDPOINT.format(id=terminal_id)
            requests.delete(delete_url, headers=HEADERS, timeout=30)

test_register_or_update_pos_terminal()