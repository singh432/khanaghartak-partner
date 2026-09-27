import os
import base64
import urllib.request

CATEGORIES = {
    'all': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=240&h=240&fit=crop&q=80',
    'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=240&h=240&fit=crop&q=80',
    'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=240&h=240&fit=crop&q=80',
    'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=240&h=240&fit=crop&q=80',
    'fastfood': 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=240&h=240&fit=crop&q=80',
    'bakery': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=240&h=240&fit=crop&q=80',
    'beverages': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=240&h=240&fit=crop&q=80',
    'sweets': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=240&h=240&fit=crop&q=80',
    'thali': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=240&h=240&fit=crop&q=80',
    'chinese': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=240&h=240&fit=crop&q=80',
    'snacks': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=240&h=240&fit=crop&q=80',
    'breakfast': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=240&h=240&fit=crop&q=80',
    'maincourse': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=240&h=240&fit=crop&q=80',
    'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=240&h=240&fit=crop&q=80',
    'rolls': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=240&h=240&fit=crop&q=80',
    'pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=240&h=240&fit=crop&q=80',
}

pub_dir = os.path.join(os.getcwd(), 'public', 'categories')
asset_dir = os.path.join(os.getcwd(), 'src', 'assets', 'categories')
os.makedirs(pub_dir, exist_ok=True)
os.makedirs(asset_dir, exist_ok=True)

b64_dict = {}

for cat, url in CATEGORIES.items():
    pub_file = os.path.join(pub_dir, f"{cat}.jpg")
    asset_file = os.path.join(asset_dir, f"{cat}.jpg")
    print(f"Downloading {cat}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        with open(pub_file, 'wb') as f:
            f.write(data)
        with open(asset_file, 'wb') as f:
            f.write(data)
        b64 = base64.b64encode(data).decode('utf-8')
        b64_dict[cat] = f"data:image/jpeg;base64,{b64}"
    print(f"✓ Saved {cat} ({len(data)} bytes)")

# Generate src/lib/categoryImages.ts
ts_code = f"""// Auto-generated category food images (offline and online safe)
export const CATEGORY_IMAGE_DATA: Record<string, string> = {repr(b64_dict)};

export function getCategoryImage(categoryName?: string | null): string {{
  if (!categoryName) return CATEGORY_IMAGE_DATA["all"];
  const clean = categoryName.trim().toLowerCase();

  if (clean === "all") return CATEGORY_IMAGE_DATA["all"];
  if (clean.includes("biryani")) return CATEGORY_IMAGE_DATA["biryani"];
  if (clean.includes("pizza")) return CATEGORY_IMAGE_DATA["pizza"];
  if (clean.includes("burger")) return CATEGORY_IMAGE_DATA["burger"];
  if (clean.includes("cake") || clean.includes("bakery") || clean.includes("pastry")) return CATEGORY_IMAGE_DATA["bakery"];
  if (clean.includes("beverage") || clean.includes("shake") || clean.includes("mojito") || clean.includes("drink") || clean.includes("tea") || clean.includes("coffee")) return CATEGORY_IMAGE_DATA["beverages"];
  if (clean.includes("sweet") || clean.includes("mithai") || clean.includes("dessert") || clean.includes("jamun") || clean.includes("rasgulla")) return CATEGORY_IMAGE_DATA["sweets"];
  if (clean.includes("thali")) return CATEGORY_IMAGE_DATA["thali"];
  if (clean.includes("chinese") || clean.includes("noodle") || clean.includes("chowmein") || clean.includes("momo")) return CATEGORY_IMAGE_DATA["chinese"];
  if (clean.includes("snack") || clean.includes("samosa") || clean.includes("pakoda") || clean.includes("tikka")) return CATEGORY_IMAGE_DATA["snacks"];
  if (clean.includes("breakfast") || clean.includes("paratha") || clean.includes("poori") || clean.includes("dosa")) return CATEGORY_IMAGE_DATA["breakfast"];
  if (clean.includes("sandwich")) return CATEGORY_IMAGE_DATA["sandwich"];
  if (clean.includes("roll")) return CATEGORY_IMAGE_DATA["rolls"];
  if (clean.includes("pasta")) return CATEGORY_IMAGE_DATA["pasta"];
  if (clean.includes("main course") || clean.includes("curry") || clean.includes("paneer") || clean.includes("dal") || clean.includes("roti")) return CATEGORY_IMAGE_DATA["maincourse"];
  if (clean.includes("fast food")) return CATEGORY_IMAGE_DATA["fastfood"];

  return CATEGORY_IMAGE_DATA["all"];
}}
"""

with open(os.path.join(os.getcwd(), 'src', 'lib', 'categoryImages.ts'), 'w') as f:
    f.write(ts_code)

print("✓ Successfully generated src/lib/categoryImages.ts with full offline image data")
