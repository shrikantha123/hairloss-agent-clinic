import requests
import os
import time

# JustDial URLs to fetch images from
urls = [
    "https://www.justdial.com/RSL-XQI1788867412",
    "https://www.justdial.com/RSL-YBD1788867598",
    "https://www.justdial.com/RSL-RFA1788867630",
    "https://www.justdial.com/RSL-BZP1788867647",
    "https://www.justdial.com/RSL-VEM1788867663",
    "https://www.justdial.com/RSL-LNV1788867690",
    "https://www.justdial.com/RSL-UME1788867705",
    "https://www.justdial.com/RSL-LQC1788867723",
    "https://www.justdial.com/RSL-XUT1788867736"
]

# Create results directory if it doesn't exist
results_dir = "src/website/results"
os.makedirs(results_dir, exist_ok=True)

def fetch_image_with_selenium(url, index):
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.common.by import By
        from webdriver_manager.chrome import ChromeDriverManager
        
        print(f"Fetching {url} with Selenium...")
        
        # Setup Chrome options
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
        
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        
        try:
            driver.get(url)
            time.sleep(5)  # Wait for page to load
            
            # Find all image elements
            images = driver.find_elements(By.TAG_NAME, 'img')
            
            print(f"Found {len(images)} img elements")
            
            for img in images:
                src = img.get_attribute('src')
                if src and ('jpg' in src or 'jpeg' in src or 'png' in src):
                    if any(x in src.lower() for x in ['justdial', 'jdmagicbox', 'content']):
                        try:
                            print(f"Attempting to download: {src}")
                            img_response = requests.get(src, timeout=10)
                            
                            if img_response.status_code == 200 and len(img_response.content) > 5000:
                                img_path = os.path.join(results_dir, f"result_{index + 1}.jpg")
                                with open(img_path, 'wb') as f:
                                    f.write(img_response.content)
                                print(f"✓ Saved to {img_path}")
                                return img_path
                        except:
                            continue
            
            print("No suitable images found")
        finally:
            driver.quit()
        
        time.sleep(2)
    except ImportError:
        print("Selenium not installed. Install with: pip install selenium webdriver-manager")
        return None
    except Exception as e:
        print(f"Error with Selenium: {e}")
        return None
    
    return None

if __name__ == "__main__":
    print("Starting to fetch images from JustDial using Selenium...")
    print("This requires Selenium and Chrome WebDriver to be installed.\n")
    
    for i, url in enumerate(urls):
        fetch_image_with_selenium(url, i)
    
    print("\nDone! Check the src/website/results folder for downloaded images.")
