import requests

BASE_URL = "http://localhost:3000"
LOGIN_PIN_ENDPOINT = "/api/auth/login/pin"
TIMEOUT = 30


def test_quick_login_with_4_digit_pin():
    tenant_slug = "cmj753uk40003wug3d36dvlfq"
    valid_pin = "1234"
    invalid_pin = "9999"

    url = BASE_URL + LOGIN_PIN_ENDPOINT

    # Test successful login with valid pin
    payload_valid = {
        "pin": valid_pin,
        "tenantSlug": tenant_slug
    }

    try:
        response_valid = requests.post(url, json=payload_valid, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed for valid PIN login: {e}"
    else:
        assert response_valid.status_code == 200, f"Expected 200 for valid PIN login, got {response_valid.status_code}"

    # Test login failure with invalid pin
    payload_invalid = {
        "pin": invalid_pin,
        "tenantSlug": tenant_slug
    }

    try:
        response_invalid = requests.post(url, json=payload_invalid, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed for invalid PIN login: {e}"
    else:
        assert response_invalid.status_code == 401, f"Expected 401 for invalid PIN login, got {response_invalid.status_code}"


test_quick_login_with_4_digit_pin()
