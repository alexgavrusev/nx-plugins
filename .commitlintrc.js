const {
  utils: { getProjects },
} = require('@commitlint/config-nx-scopes');
const { readJson } = require('fs-extra');
const { resolve } = require('path');

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': async (ctx) => {
      const rootProjectJson = await readJson(
        resolve(__dirname, 'project.json')
      );
      const rootProjectName = rootProjectJson.name;

      // do not allow to specify the workspace-level project name as a scope
      const projectScopes = await getProjects(
        ctx,
        ({ name }) => name !== rootProjectName
      );

      return [2, 'always', [...projectScopes, 'docs', 'ci']];
    },
  },
};
