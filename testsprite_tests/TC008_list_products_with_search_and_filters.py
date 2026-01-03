import requests

BASE_URL = "http://localhost:3000"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWo3NTN1d28wMDBod3VnM2diN3gya2V1IiwidGVuYW50SWQiOiJjbWo3NTN1azQwMDAzd3VnM2QzNmR2bGZxIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGVJZCI6ImNtajc1M3VrODAwMDV3dWczemFpZDV4eXMiLCJwZXJtaXNzaW9ucyI6WyIqIl0sImJyYW5jaElkIjoiY21qNzUzdWtmMDAwYnd1ZzNkcmc0M2N3cyIsImlhdCI6MTc2NjMyNjc5MywiZXhwIjoxNzY2OTMxNTkzfQ.C-LUk0oIlX9_GzhUB8bAdZO-QFZKJXTdv5ZjognsyWs"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}"
}

def test_list_products_with_search_and_filters():
    url = f"{BASE_URL}/api/products"
    
    # Test cases with various filters including search, categoryId, brandId, branchId, isActive, page, pageSize
    test_params_list = [
        {},  # no filter, default pagination
        {"search": "sample"},
        {"categoryId": "cat123"},
        {"brandId": "brand123"},
        {"branchId": "branch123"},
        {"isActive": True},
        {"isActive": False},
        {"page": 1, "pageSize": 10},
        {"search": "test", "categoryId": "cat123", "brandId": "brand123", "branchId": "branch123", "isActive": True, "page": 2, "pageSize": 5}
    ]
    
    for params in test_params_list:
        try:
            response = requests.get(url, headers=HEADERS, params=params, timeout=30)
        except requests.RequestException as e:
            assert False, f"Request failed: {e}"

        assert response.status_code == 200, f"Expected status 200 but got {response.status_code} for params {params}"

        try:
            data = response.json()
        except ValueError:
            assert False, f"Response is not a valid JSON for params {params}"

        # Validate that response contains pagination keys and products list
        assert isinstance(data, dict), f"Response data is not a dict for params {params}"
        assert "items" in data or "products" in data, f"Response missing 'items' or 'products' key for params {params}"
        
        # Validate that items/products is a list
        items = data.get("items") or data.get("products")
        assert isinstance(items, list), f"'items' or 'products' is not a list for params {params}"
        
        # Validate pagination meta if present
        if "page" in data:
            assert isinstance(data["page"], int), f"'page' should be int in response for params {params}"
        if "pageSize" in data:
            assert isinstance(data["pageSize"], int), f"'pageSize' should be int in response for params {params}"
        if "total" in data:
            assert isinstance(data["total"], int), f"'total' should be int in response for params {params}"

test_list_products_with_search_and_filters()