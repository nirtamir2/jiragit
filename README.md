# @nirtamir2/jiragit

![npm](https://img.shields.io/npm/v/@nirtamir2/jiragit)

CLI to create git branches from JIRA tasks

## Demo

https://user-images.githubusercontent.com/16452789/157350361-03b86b8c-7b62-4528-991c-7368a721b671.mp4

https://user-images.githubusercontent.com/16452789/157350377-9179329a-b5b7-412a-a6bf-f7b255f0d538.mp4

## Installation

```bash
npm i -g @nirtamir2/jiragit
```

## Running

```bash
jiragit
```

## Config

When you run the CLI in the first time, you need to edit the config file at `~/jiragit.config.json`.

```json
{
  "email": "me@mycompany.com",
  "token": "TODO: generate in https://id.atlassian.com/manage-profile/security/api-tokens",
  "host": "https://mycompany.atlassian.net",
  "projectKey": "Example: for issue like ABC-123 ABC is the project key"
}
```
