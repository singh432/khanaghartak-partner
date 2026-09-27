import os
import json
import urllib.request
import urllib.parse
import subprocess

CATEGORIES = [
    {
        "id": "all",
        "search": "Indian food feast platter",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg/400px-Good_Food_Display_-_NCI_Visuals_Online.jpg"
    },
    {
        "id": "biryani",
        "search": "Hyderabadi Biryani food",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/400px-%22Hyderabadi_Dum_Biryani%22.jpg"
    },
    {
        "id": "pizza",
        "search": "Pizza Margherita food",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Eq_it-na_pizza-margherita_sep2005_sml.jpg/400px-Eq_it-na_pizza-margherita_sep2005_sml.jpg"
    },
    {
        "id": "burger",
        "search": "Cheeseburger fast food",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cheeseburger.jpg/400px-Cheeseburger.jpg"
    },
    {
        "id": "fastfood",
        "search": "French Fries hamburger fast food",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Cheeseburger_with_fries.jpg/400px-Cheeseburger_with_fries.jpg"
    },
    {
        "id": "bakery",
        "search": "Chocolate Cake pastry",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Pound_layer_cake.jpg/400px-Pound_layer_cake.jpg"
    },
    {
        "id": "beverages",
        "search": "Mojito fruit drink cocktail",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Mojito_cocktail.jpg/400px-Mojito_cocktail.jpg"
    },
    {
        "id": "sweets",
        "search": "Gulab Jamun Indian sweet",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Gulab_jamun_%28Indian_sweet%29.jpg/400px-Gulab_jamun_%28Indian_sweet%29.jpg"
    },
    {
        "id": "thali",
        "search": "North Indian Thali meal",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/North_Indian_Thali.jpg/400px-North_Indian_Thali.jpg"
    },
    {
        "id": "chinese",
        "search": "Veg Hakka Noodles chow mein",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Chow_mein.jpg/400px-Chow_mein.jpg"
    },
    {
        "id": "snacks",
        "search": "Indian Samosa snack",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Samosa.jpg/400px-Samosa.jpg"
    },
    {
        "id": "breakfast",
        "search": "Aloo Paratha Indian breakfast",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Aloo_Paratha_also_known_as_Batata_Paratha.jpg/400px-Aloo_Paratha_also_known_as_Batata_Paratha.jpg"
    },
    {
        "id": "maincourse",
        "search": "Shahi Paneer curry butter masala",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Shahi_paneer.jpg/400px-Shahi_paneer.jpg"
    },
    {
        "id": "sandwich",
        "search": "Club sandwich grilled vegetable",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Club_sandwich.jpg/400px-Club_sandwich.jpg"
    },
    {
        "id": "rolls",
        "search": "Kathi Roll wrap",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Kathi_roll.jpg/400px-Kathi_roll.jpg"
    }
]

def search_wikimedia(query):
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'KhanaGharTakBot/1.0 (contact@khanaghartak.in)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                title = page_data.get("title", "").lower()
                # filter out pdf, svg, audio, icon
                if any(ext in title for ext in [".jpg", ".jpeg", ".png"]):
                    imageinfo = page_data.get("imageinfo", [])
                    if imageinfo:
                        thumburl = imageinfo[0].get("thumburl") or imageinfo[0].get("url")
                        if thumburl and "upload.wikimedia.org" in thumburl:
                            return thumburl
    except Exception as e:
        print(f"Error searching {query}: {e}")
    return None

def download_and_process(cat):
    cat_id = cat["id"]
    out_dir = os.path.join(os.getcwd(), "public", "categories")
    os.makedirs(out_dir, exist_ok=True)
    out_png = os.path.join(out_dir, f"{cat_id}.png")

    img_url = search_wikimedia(cat["search"])
    if not img_url:
        img_url = cat.get("fallback_url")

    print(f"Downloading {cat_id} from {img_url}...")
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    req = urllib.request.Request(img_url, headers=headers)
    raw_path = os.path.join(out_dir, f"raw_{cat_id}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp, open(raw_path, "wb") as f:
            f.write(resp.read())

        # Convert to PNG using sips
        subprocess.run(["/usr/bin/sips", "-s", "format", "png", raw_path, "--out", out_png], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Crop to square using sips -c height width
        # First get dimensions
        dim_proc = subprocess.run(["/usr/bin/sips", "-g", "pixelWidth", "-g", "pixelHeight", out_png], capture_output=True, text=True, check=True)
        lines = dim_proc.stdout.splitlines()
        w, h = 300, 300
        for line in lines:
            if "pixelWidth" in line:
                w = int(line.split(":")[-1].strip())
            elif "pixelHeight" in line:
                h = int(line.split(":")[-1].strip())
        min_dim = min(w, h)
        subprocess.run(["/usr/bin/sips", "-c", str(min_dim), str(min_dim), out_png], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Resample to 200x200
        subprocess.run(["/usr/bin/sips", "-z", "200", "200", out_png], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"✓ Saved {cat_id} (200x200 PNG) -> {out_png}")
        if os.path.exists(raw_path):
            os.remove(raw_path)
    except Exception as e:
        print(f"Failed {cat_id}: {e}")
        if os.path.exists(raw_path):
            os.remove(raw_path)

if __name__ == "__main__":
    for cat in CATEGORIES:
        download_and_process(cat)
