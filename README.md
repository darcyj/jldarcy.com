# jldarcy.com

Single-page personal website for John L. Darcy, PhD.

## Local preview

Run any local web server from this folder. Example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Update publications

1. Edit `data/publications.bib`
2. Reload the page

The publications section is generated in-browser from that BibTeX file.

## Files

- `index.html` - page structure
- `styles.css` - visual system + responsive layout
- `main.js` - motion, nav behavior, and BibTeX parsing/rendering
- `assets/photos/` - expedition photography
- `assets/docs/` - CV/resume downloads
