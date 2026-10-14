# Getting Started with Create React App

## Automatic deployment

Set **Settings → Pages → Custom domain** to `www.mueller-it-mkk.de` and save.
The DNS CNAME for `www` must point to `tschanni.github.io` without a repository
path. Enable **Enforce HTTPS** when available. Actions deployments require this
repository setting; `public/CNAME` preserves the domain for branch-based builds
but does not configure the domain when using Actions.

The build uses relative asset URLs (`homepage: "."`) to support both the custom
domain root and `/mueller-it-mkk/`. After saving the domain, push these changes
or run the deployment workflow manually, then hard-refresh the browser.

The workflow in `.github/workflows/deploy-pages.yml` tests, builds, and deploys
the website to GitHub Pages on every push to `main`. It can also be started
manually from the Actions tab using **Run workflow**.

Before the first run, set **Settings → Pages → Build and deployment → Source**
to **GitHub Actions** in the GitHub repository. Commit and push the workflow to
`main` to start the first deployment. Failed tests or builds prevent publication.

The workflow uses the built-in `GITHUB_TOKEN`; no personal access token is needed.
The existing `npm run deploy` command is retained for the former branch-based
deployment setup, but is not used by this workflow.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
