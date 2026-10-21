# Genera una sola página con la demo (sin Supabase) para verla como artifact. Uso: python3 build-demo.py salida.html
import re, sys, pathlib
d = pathlib.Path(__file__).parent
html = (d/"index.html").read_text()
body = html.split("<!--APP-START-->")[1].split("<!--APP-END-->")[0]
fonts = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', html).group(0)
out = f"""<title>Gastos de Casa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
{fonts}
<style>
{(d/'styles.css').read_text()}
</style>
<script>
{(d/'tema.js').read_text()}
</script>
{body}
<script>
{(d/'store.js').read_text()}
</script>
<script>
{(d/'app.js').read_text()}
</script>
"""
pathlib.Path(sys.argv[1]).write_text(out)
