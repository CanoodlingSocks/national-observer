# The National Observer

A fake online newspaper for the solo journaling game [Serious Reading](https://atypicalfaux.itch.io/serious-reading).

You play the journalist. You write absurd dispatches, publish them, and then read the paper as if a stranger had just picked it up. The journalists, the opinions, and the frogs are fictional. Please do not cite this in a real argument.

This is a small web app, vibe-coded for fun and immersion. It has no accounts, no server, and no interest in becoming a publishing platform.

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints. **The desk** is where you write. **The paper** is what a visitor sees.

`npm test` runs the checks. `npm run build` then `npm run preview` shows the public site, which is read-only.

## Writing, backups, and the public edition

Pieces live in this browser while you are writing. The first time The Desk opens in an empty browser, it copies `public/edition.json` into that browser so an existing piece can be edited or deleted. After that, this browser keeps its own copy: a deletion stays deleted, and `edition.json` changes only when you download a new edition and replace the file. **Save draft** keeps an unfinished piece, even without a headline. **Mark ready** means it is finished but still off the paper. **Publish** puts it on this browser’s paper only. A featured piece needs a short description before it can be marked ready or published. Front-page order is the Move earlier / Move later list on the desk.

**Export backup** downloads everything in this browser: drafts, published pieces, authors, and images. **Import backup** replaces that local copy after you confirm. Use this when you want a private safety copy.

**Download published edition** downloads `edition.json` with only published pieces, the authors those pieces use (including a portrait, when one is saved), the images those pieces use, their tags, and their front-page order. It does not change anything stored in the browser, and it does not update the public website.

If nothing is published, the file is empty and the site still says that no dispatches have been published.

The production build does not include the desk. Local development does.

## GitHub Pages

The repository name this build expects is `national-observer`, so the public address is:

`https://<your-github-name>.github.io/national-observer/`

`.github/workflows/pages.yml` builds and deploys when `main` is updated. In the GitHub repository settings, set Pages to deploy with GitHub Actions. The first time, GitHub may ask you to allow the workflow.

Day to day, write on the `dev` branch. The live site updates only when `main` is pushed. The address is [https://canoodlingsocks.github.io/national-observer/](https://canoodlingsocks.github.io/national-observer/).

## Publishing a new edition

Publishing a piece in The Desk updates this browser. It does not change GitHub Pages. The public site reads `public/edition.json` from `main`.

1. On `dev`, run `npm run dev`. In The Desk, save the author (a portrait is optional), write the piece, and choose **Publish**.
2. On the desk, choose **Download published edition**. That saves `edition.json` on your computer.
3. Replace `public/edition.json` in this project with that file.
4. Commit it on `dev`, merge into `main`, and push `main`:

```bash
git add public/edition.json
git commit -m "Publish the latest edition."
git checkout main
git merge dev
git push origin main
git checkout dev
```

5. Wait for the **Deploy GitHub Pages** workflow on `main`. Then open the live site and the article.

`.github/workflows/pages.yml` runs on a push to `main`. A commit that stays on `dev` does not deploy. Drafts, pieces marked ready, and authors who have no published piece stay out of `edition.json`.

To change a piece that is already on the site, or to add another one, edit and publish it in The Desk, download a new edition, and repeat steps 3–5. Each download is the whole published paper, so the new `public/edition.json` replaces the previous one.
