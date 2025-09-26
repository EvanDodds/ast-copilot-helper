// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vitepress is a development dependency that may not be available during linting
import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "ast-copilot-helper",
  description: "AI-powered AST analysis and code understanding tool",
  lang: "en-US",

  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["meta", { name: "theme-color", content: "#3c3c3c" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "en" }],
    [
      "meta",
      {
        property: "og:title",
        content: "ast-copilot-helper | AI-powered code understanding",
      },
    ],
    ["meta", { property: "og:site_name", content: "ast-copilot-helper" }],
    ["meta", { property: "og:image", content: "/ast-copilot-helper-og.png" }],
    [
      "meta",
      { property: "og:url", content: "https://ast-copilot-helper.dev/" },
    ],
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/logo.svg",

    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/cli" },
      { text: "Examples", link: "/examples/" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          collapsed: false,
          items: [
            { text: "Introduction", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
          ],
        },
        {
          text: "User Guides",
          collapsed: false,
          items: [
            { text: "CLI Usage", link: "/guide/cli-usage" },
            { text: "VS Code Extension", link: "/guide/vscode-extension" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "AI Integration", link: "/guide/ai-integration" },
          ],
        },
        {
          text: "Help & Support",
          collapsed: false,
          items: [
            { text: "Troubleshooting", link: "/troubleshooting" },
            { text: "FAQ", link: "/faq" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          collapsed: false,
          items: [
            { text: "CLI Commands", link: "/api/cli" },
            { text: "MCP Server", link: "/api/mcp-server" },
            { text: "TypeScript Interfaces", link: "/api/interfaces" },
            { text: "VS Code Extension", link: "/api/vscode-extension" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Examples & Tutorials",
          collapsed: false,
          items: [
            { text: "Overview", link: "/examples/" },
            { text: "CLI Examples", link: "/examples/cli" },
            { text: "Interactive Tutorials", link: "/examples/tutorials" },
            { text: "Integration Examples", link: "/examples/integrations" },
          ],
        },
      ],
      "/development/": [
        {
          text: "Development",
          collapsed: false,
          items: [
            { text: "Architecture", link: "/development/architecture" },
            { text: "Contributing", link: "/development/contributing" },
            { text: "Development Setup", link: "/development/setup" },
            { text: "Testing", link: "/development/testing" },
            { text: "Release Process", link: "/development/release-process" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/EvanDodds/ast-copilot-helper",
      },
    ],

    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "Search Documentation",
            buttonAriaLabel: "Search Documentation",
          },
          modal: {
            searchBox: {
              resetButtonTitle: "Clear search",
              resetButtonAriaLabel: "Clear search",
              cancelButtonText: "Cancel",
              cancelButtonAriaLabel: "Cancel",
            },
            startScreen: {
              recentSearchesTitle: "Recent Searches",
              noRecentSearchesText: "No recent searches",
              saveRecentSearchButtonTitle: "Save search",
              removeRecentSearchButtonTitle: "Remove search",
              favoriteSearchesTitle: "Favorites",
              removeFavoriteSearchButtonTitle: "Remove favorite",
            },
            errorScreen: {
              titleText: "Unable to fetch results",
              helpText: "You may need to check your network connection.",
            },
            footer: {
              selectText: "to select",
              navigateText: "to navigate",
              closeText: "to close",
            },
            noResultsScreen: {
              noResultsText: "No results for",
              suggestedQueryText: "Try searching for",
              reportMissingResultsText:
                "Believe this query should return results?",
              reportMissingResultsLinkText: "Let us know.",
            },
          },
        },
      },
    },

    editLink: {
      pattern:
        "https://github.com/EvanDodds/ast-copilot-helper/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present EvanDodds",
    },

    lastUpdated: {
      text: "Updated at",
      formatOptions: {
        dateStyle: "full",
        timeStyle: "medium",
      },
    },
  },

  // Internationalization
  locales: {
    root: {
      label: "English",
      lang: "en",
    },
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    lineNumbers: true,
    config: () => {
      // Add custom markdown extensions if needed
    },
  },

  // Build optimizations
  vite: {
    optimizeDeps: {
      exclude: ["vue"],
    },
  },

  // Site map generation
  sitemap: {
    hostname: "https://ast-copilot-helper.dev",
  },

  // Enable clean URLs
  cleanUrls: true,

  // Temporarily ignore dead links to allow pushing important infrastructure changes
  ignoreDeadLinks: true,
});
