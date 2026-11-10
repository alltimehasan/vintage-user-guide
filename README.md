# Vintage Warehouse Glasgow help guide

A static help website in two parts:

- `admin.html`: the shop team guide (orders, products, messages, pages, settings).
- `customers.html`: help for customers (finding a bag, paying, accounts, delivery, returns).
- `index.html`: the start page linking the two.

There is no build step. The pages are plain HTML. `assets/guide.css` and `assets/guide.js` style them and run the search, the contents list, the light/dark switch and the full-size screenshots. The fonts and logos in `assets/` come from the shop's design system; the font licences are in `assets/fonts/`.

## Preview on your computer

```bash
cd user-guide
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the files straight from disk works too, but the search then covers only the page you are on.

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `vwg-help-guide`, and push the contents of this folder to its `main` branch.
2. In the repository, go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`, and save.
3. After a minute or two the guide is live at `https://<your-user>.github.io/vwg-help-guide/`.

The empty `.nojekyll` file tells GitHub to serve the files exactly as they are.

## Publish on the shop's server

The guide is also served at https://docs.vintagewarehouseglasgow.co.uk, from the `public_html/docs` folder on 20i (the subdomain's folder). Upload it again after a change, from the folder that holds `user-guide`:

```bash
rsync -az --delete --exclude='.git/' --exclude='/README.md' --exclude='/.nojekyll' \
  user-guide/ simon-vintage:/home/sites/34a/5/51ceccf406/public_html/docs/
```

- `simon-vintage` is the SSH host from your `~/.ssh/config`. `--delete` keeps the folder identical to `user-guide`, and touches nothing outside `docs/`.
- `.htaccess` switches off the shop's rewrite rules, which Apache would otherwise apply from the folder above, and stops folder listings. GitHub Pages ignores it.
- The live site's deploy protects `docs/`, so deploying `main` never deletes the guide.
- 20i's CDN can keep an old copy of a page for a few minutes after an upload.

## Search engines

Every page has `<meta name="robots" content="noindex">`, so the guide stays out of Google while it lives on a github.io address. Remove that line from the three pages if the guide should be found by search, for example once it has the shop's own domain.

## Keeping it up to date

- The screenshots in `images/` come from a practice copy of the website with example bags, customers and orders, at the address www.example.co.uk. To refresh one, replace the file with a new screenshot of the same name. Screenshots taken at twice the screen size (for example 2560 pixels wide for a 1280-pixel window), saved as WebP, stay sharp.
- The customer guide quotes the delivery times as an example ("Dispatched within 2 working days…"). Change it in `customers.html` if Settings → Shop changes.
- The admin guide describes the website as built in November 2026. When a feature changes, update the matching section; each section has an `id`, which the start page and the search use.
