import streamlit as st
import cv2
import numpy as np
from pyzbar import pyzbar
import hashlib
import time
from datetime import datetime

# -----------------------------
# מסד נתונים זמני (Mock Database)
# -----------------------------
PRODUCTS = {
    "123456": {"name": "הפוך גדול", "price": 15},
    "234567": {"name": "אמריקנו קר", "price": 12},
    "345678": {"name": "כריך חלומי", "price": 28},
    "456789": {"name": "עוגיית שוקולד צ'יפס", "price": 9},
    "567890": {"name": "מיץ תפוזים", "price": 14}
}

# -----------------------------
# פונקציות עזר
# -----------------------------
def scan_barcode(frame):
    barcodes = pyzbar.decode(frame)
    for barcode in barcodes:
        barcode_data = barcode.data.decode("utf-8")
        return barcode_data
    return None

def simulate_blockchain_tx(product_name, price):
    with st.spinner("🔗 מבצע טרנזקציה מאובטחת בבלוקצ'יין..."):
        time.sleep(2)
    tx_hash = hashlib.sha256(f"{product_name}{price}{time.time()}".encode()).hexdigest()[:12]
    return tx_hash

# -----------------------------
# עיצוב וממשק משתמש (UI)
# -----------------------------
st.set_page_config(page_title="Rebel AI POS", layout="centered")

# עיצוב מותאם אישית (CSS)
st.markdown(
    """
    <style>
    .main { background-color: #0e1117; }
    .stButton>button {
        background-color: #00ffcc;
        color: black;
        font-weight: bold;
        border-radius: 10px;
        width: 100%;
        height: 3em;
    }
    h1 { color: #00ffcc; text-align: center; }
    </style>
    """,
    unsafe_allow_html=True
)

st.title("☕ Rebel AI")
st.subheader("סריקה ותשלום מהיר")

# שימוש במצלמת הטלפון/מחשב
uploaded = st.camera_input("סרוק ברקוד של מוצר:")

if uploaded:
    # המרת התמונה לפורמט ש-OpenCV מבין
    file_bytes = np.asarray(bytearray(uploaded.getbuffer()), dtype=np.uint8)
    frame = cv2.imdecode(file_bytes, 1)
    
    # ניסיון זיהוי ברקוד
    barcode = scan_barcode(frame)
    
    if barcode:
        if barcode in PRODUCTS:
            product = PRODUCTS[barcode]
            st.success(f"✅ זוהה: {product['name']}")
            st.metric(label="מחיר", value=f"{product['price']} ₪")
            
            if st.button("💸 שלם עכשיו"):
                tx_hash = simulate_blockchain_tx(product['name'], product['price'])
                st.balloons()
                st.success(f"התשלום אושר! קוד עסקה: {tx_hash}")
                
                # שמירת לוג (נתונים) לניתוח עתידי
                st.info(f"דאטה נרשם: {product['name']} נרכש ב-{datetime.now().strftime('%H:%M:%S')}")
        else:
            st.warning(f"ברקוד ({barcode}) לא נמצא במערכת. נסה מוצר אחר.")
    else:
        st.info("מצלמה פעילה. אנא הצמד ברקוד למרכז הפריים.")

st.markdown("---")
st.caption("Rebel AI - תשתית פיננסית חכמה לעסקים")