#!/usr/bin/env node
import JiraJS from "jira.js";
import openEditor from "open-editor";
import prompts from "prompts";
import type { ZodSchema } from "zod";
import { z } from "zod";
import { $, chalk, fs, os, path } from "zx";
import type { JiraConfig } from "./jiraConfig";

const configFilePath = path.join(os.homedir(), "./jiragit.config.json");

enum Action {
  CheckoutExistingIssue = "CheckoutExistingIssue",
  CreateNewIssue = "CreateNewIssue",
}

const DEFAULT_CONFIG: JiraConfig = {
  email: "me@mycompany.com",
  token:
    "TODO: generate in https://id.atlassian.com/manage-profile/security/api-tokens",
  host: "https://mycompany.atlassian.net",
  projectKey: "Example: for issue like ABC-123 ABC is the project key",
  jql:
    "assignee in (currentUser()) and sprint in openSprints() and statusCategory in ('To Do') order by created DESC",
};

const JiraConfigSchema: ZodSchema<JiraConfig> = z.object({
  email: z.string().email(),
  token: z.string(),
  host: z.string().url(),
  projectKey: z.string(),
  jql: z.string(),
});

function logInfoData(text: string) {
  // eslint-disable-next-line no-console
  console.log(chalk.green(text));
}

function throwCancelOperationError() {
  throw new Error(`${chalk.red("✖")} Operation cancelled`);
}

function getJiraIssueUrl({ host, key }: { host: string; key: string }) {
  return `${host}/browse/${key}`;
}

function convertToHyphenCase(text: string) {
  return text.replace(/\W+/g, "-").toLowerCase();
}

async function createBranchForExistingIssue({
  jiraClient,
  jiraConfig,
}: {
  jiraClient: JiraJS.Version2Client;
  jiraConfig: JiraConfig;
}) {
  const searchIssues = await jiraClient.issueSearch.searchForIssuesUsingJql({
    jql: jiraConfig.jql,
    fields: ["summary", "description"],
  });

  const { issue } = (await prompts(
    [
      {
        type: "autocomplete",
        message: "Select an issue:",
        name: "issue",
        // Because it requires a Promise in TypeScript
        // eslint-disable-next-line @typescript-eslint/require-await
        suggest: async (input: string, choices) => {
          return choices.filter((choice) => {
            return (
              choice.title.includes(input) ||
              choice.description?.includes(input)
            );
          });
        },
        choices:
          searchIssues.issues?.map((issue) => {
            return {
              title: issue.key,
              value: issue,
              description: issue.fields.summary,
            };
          }) ?? [],
      },
    ],
    { onCancel: throwCancelOperationError }
  )) as { issue: JiraJS.Version2.Version2Models.Issue };

  const { branchName } = (await prompts(
    {
      type: "text",
      name: "branchName",
      message: "Branch name:",
      initial: `${issue.key}-${convertToHyphenCase(issue.fields.summary)}`,
    },
    { onCancel: throwCancelOperationError }
  )) as { branchName: string };

  logInfoData(getJiraIssueUrl({ host: jiraConfig.host, key: issue.key }));

  await $`git checkout -b ${branchName}`;
}

async function initConfig() {
  fs.writeJsonSync(configFilePath, DEFAULT_CONFIG);
  logInfoData(`Created a config file in path "${configFilePath}"`);
  const { shouldOpenFile } = (await prompts(
    {
      type: "confirm",
      name: "shouldOpenFile",
      message: "Do you want to open it now?",
      initial: true,
    },
    { onCancel: throwCancelOperationError }
  )) as { shouldOpenFile: boolean };

  if (shouldOpenFile) {
    openEditor([
      {
        file: configFilePath,
      },
    ]);
    chalk.blue("Please edit your file an rerun the jiragit command");
  }
}

async function createBranchForNewJiraIssue({
  jiraClient,
  jiraConfig,
}: {
  jiraClient: JiraJS.Version2Client;
  jiraConfig: JiraConfig;
}) {
  const issueTypes = await jiraClient.issueTypes.getIssueAllTypes();
  const { issueType } = (await prompts(
    [
      {
        type: "select",
        name: "issueType",
        message: "Issue type:",
        choices: issueTypes.flatMap((issueType) => {
          if (issueType.name == null) {
            return [];
          }
          return {
            value: issueType,
            title: issueType.name,
            description: issueType.description,
          };
        }),
      },
    ],
    { onCancel: throwCancelOperationError }
  )) as { issueType: JiraJS.Version2Models.IssueTypeScheme };

  const { summary, description } = (await prompts(
    [
      {
        type: "text",
        message: "Summary:",
        name: "summary",
      },
      {
        type: "text",
        message: "Description:",
        name: "description",
      },
    ],
    { onCancel: throwCancelOperationError }
  )) as { summary: string; description: string };

  const currentUser = await jiraClient.myself.getCurrentUser();

  const newIssue = await jiraClient.issues.createIssue({
    fields: {
      issuetype: { id: issueType.id },
      project: {
        key: jiraConfig.projectKey,
      },
      assignee: {
        id: currentUser.accountId,
      },
      summary,
      description,
    },
  });

  const jiraIssueUrl = getJiraIssueUrl({
    host: jiraConfig.host,
    key: newIssue.key,
  });

  logInfoData(`Created new issue in ${jiraIssueUrl}`);

  const initialBranchName = `${newIssue.key}-${convertToHyphenCase(summary)}`;

  const { branchName } = (await prompts(
    {
      type: "text",
      name: "branchName",
      message: "Branch name:",
      initial: initialBranchName,
    },
    { onCancel: throwCancelOperationError }
  )) as { branchName: string };

  await $`git checkout -b ${branchName}`;
}

async function init() {
  const hasExistingConfig = fs.pathExistsSync(configFilePath);
  if (!hasExistingConfig) {
    await initConfig();
    return;
  }

  // unicorn/prefer-json-parse-buffer - TypeScript have problems converting string to buffer
  // security/detect-non-literal-fs-filename - configFilePath variable is constant
  // eslint-disable-next-line security/detect-non-literal-fs-filename, unicorn/prefer-json-parse-buffer
  const content: unknown = JSON.parse(fs.readFileSync(configFilePath, "utf8"));

  const jiraConfig: JiraConfig = JiraConfigSchema.parse(content);

  const { email, token, host } = jiraConfig;

  const jiraClient = new JiraJS.Version2Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken: token,
      },
    },
  });

  const { action } = (await prompts(
    {
      name: "action",
      message: "Action:",
      type: "select",
      choices: [
        {
          title: "New issue",
          value: Action.CreateNewIssue,
        },
        {
          title: "Existing issue",
          value: Action.CheckoutExistingIssue,
        },
      ],
    },
    {
      onCancel: throwCancelOperationError,
    }
  )) as { action: Action };

  switch (action) {
    case Action.CheckoutExistingIssue:
      return createBranchForExistingIssue({ jiraClient, jiraConfig });
    case Action.CreateNewIssue:
      return createBranchForNewJiraIssue({ jiraClient, jiraConfig });
  }
}

try {
  void init();
} catch (error) {
  const parsedError = z.object({ message: z.string() }).safeParse(error);
  if (parsedError.success) {
    // eslint-disable-next-line no-console
    console.log(parsedError.data.message);
  } else {
    console.error(error);
  }
}
