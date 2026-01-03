import requests

BASE_URL = "http://localhost:3000"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWo3NTN1d28wMDBod3VnM2diN3gya2V1IiwidGVuYW50SWQiOiJjbWo3NTN1azQwMDAzd3VnM2QzNmR2bGZxIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGVJZCI6ImNtajc1M3VrODAwMDV3dWczemFpZDV4eXMiLCJwZXJtaXNzaW9ucyI6WyIqIl0sImJyYW5jaElkIjoiY21qNzUzdWtmMDAwYnd1ZzNkcmc0M2N3cyIsImlhdCI6MTc2NjMyNjc5MywiZXhwIjoxNzY2OTMxNTkzfQ.C-LUk0oIlX9_GzhUB8bAdZO-QFZKJXTdv5ZjognsyWs"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}


def test_create_new_sale_with_multiple_items_and_payments():
    url = f"{BASE_URL}/api/sales"
    payload = {
        "branchId": "branch-123",
        "pointOfSaleId": "pos-456",
        "customerId": "customer-789",
        "receiptType": "INVOICE_B",
        "items": [
            {
                "productId": "product-001",
                "quantity": 2,
                "unitPrice": 10.0,
                "discount": 0,
                "notes": "First item note"
            },
            {
                "productId": "product-002",
                "quantity": 1,
                "unitPrice": 20.0,
                "discount": 5,
                "notes": "Second item note"
            }
        ],
        "payments": [
            {
                "method": "CASH",
                "amount": 20.0,
                "details": {}
            },
            {
                "method": "CARD",
                "amount": 15.0,
                "details": {
                    "cardNumber": "4111111111111111",
                    "authorizationCode": "AUTH1234"
                }
            }
        ],
        "notes": "Test sale with multiple items and payments"
    }

    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=30)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}"
        data = response.json()
        assert "id" in data, "Response JSON missing sale ID"
        sale_id = data["id"]
    except requests.RequestException as e:
        assert False, f"Request failed: {str(e)}"
    finally:
        # Clean up by deleting the created sale if sale_id exists
        if 'sale_id' in locals():
            try:
                del_response = requests.delete(f"{url}/{sale_id}", headers=HEADERS, timeout=30)
                # Deletion might or might not be supported, so we do not assert here
            except requests.RequestException:
                pass


test_create_new_sale_with_multiple_items_and_payments()