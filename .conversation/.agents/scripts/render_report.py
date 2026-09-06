from pathlib import Path
import fitz

source = Path("attached_assets/BuyQK_Voice_AI_Agent_Clean_Architecture_Report_1788694228526.pdf")
output = Path(".agents/outputs/report_pages")
output.mkdir(parents=True, exist_ok=True)

doc = fitz.open(source)
print(f"pages={doc.page_count}")
for index, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    path = output / f"page-{index + 1:02d}.png"
    pix.save(path)
    print(path)