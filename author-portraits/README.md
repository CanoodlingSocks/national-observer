# Author portraits

Put a columnist’s photograph in this folder. The paper uses it at the end of that person’s published articles when the desk has no portrait saved for them.

A portrait already saved on the author stays in place. These files do not replace it. Mercedes Jorimara Fack-Bisbar, Thaddeus R. Pinchpenny, and Biddy G. Ossip already have saved portraits in the current edition, so their files here are the fallback for a later edition that does not include a saved portrait.

## What to add

Use JPEG, PNG, WebP, or GIF. A square photograph crops most cleanly. Keep the file under 8 MB.

Name the file from the columnist’s name, in lowercase, with spaces and punctuation turned into hyphens, then `-portrait` and the extension:

```text
author-portraits/lincoln-windsor-aircors-portrait.jpg
author-portraits/mercedes-jorimara-fack-bisbar-portrait.png
author-portraits/thaddeus-r-pinchpenny-portrait.png
author-portraits/biddy-g-ossip-portrait.png
```

A file named with the author’s existing `id` also works. The id is the one already stored on the author, in `public/edition.json`. An id file is used ahead of the name file:

```text
author-portraits/<author-id>.jpg
```

Other filenames in this folder are kept for you, and are not printed. `lincoln-windsor-aircors-sitting-at-desk.png` is one of those. To print that photograph instead, replace `lincoln-windsor-aircors-portrait.png` with it, using the portrait filename above.

## Lincoln Windsor Aircors on the public site

His portrait file is already `author-portraits/lincoln-windsor-aircors-portrait.png`. The public site can show it once a published piece uses him and the edition has no saved portrait for him.

1. On the writing machine, publish a piece by Lincoln, or confirm one is already published there.
2. If the desk has a portrait saved for him, remove it. Otherwise that saved portrait is what prints.
3. Choose **Download published edition** and replace `public/edition.json` with that file. His `name` in that file must stay `Lincoln Windsor Aircors`.
4. Commit `author-portraits/lincoln-windsor-aircors-portrait.png` and `public/edition.json` on `dev`, merge into `main`, and push `main`.

GitHub Pages builds `main`. After the **Deploy GitHub Pages** workflow finishes, the portrait appears at the end of his published articles. A file that stays only on your computer, or only on `dev`, does not.
