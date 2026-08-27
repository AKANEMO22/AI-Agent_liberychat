# 11 — TOOL SCHEMA PROOF & REGISTRATION VERIFICATION
## Phase R16.1: Exact Schemas Sent to Qwen2.5-Coder

### Candidate: `A_BASELINE`
- **Tool Schema SHA256**: `16cbb335d9218cdd785dd505d1e2e76853c2a4807d6d33fe0633acfdca79a065`
- **Exposed Edit Function**: `edit_file`
```json
[
  {
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "Read file contents within workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          }
        },
        "required": [
          "file_path"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "edit_file",
      "description": "Edit file via exact target replacement.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          },
          "target_content": {
            "type": "string"
          },
          "replacement_content": {
            "type": "string"
          }
        },
        "required": [
          "file_path",
          "target_content",
          "replacement_content"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_test",
      "description": "Execute unit tests in workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "test_id": {
            "type": "string"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_text",
      "description": "Search workspace contents for query.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "git_diff",
      "description": "Get git diff of changes.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
]
```


### Candidate: `C1_OLD_LINE`
- **Tool Schema SHA256**: `c2c0e88870ff9d970c4d7d87bcaa1ed32289d3ba35f844586917ede836b632e2`
- **Exposed Edit Function**: `replace_lines`
```json
[
  {
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "Read file contents within workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          }
        },
        "required": [
          "file_path"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "replace_lines",
      "description": "Replace line range in file.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          },
          "start_line": {
            "type": "integer"
          },
          "end_line": {
            "type": "integer"
          },
          "replacement": {
            "type": "string"
          }
        },
        "required": [
          "file_path",
          "start_line",
          "end_line",
          "replacement"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_test",
      "description": "Execute unit tests in workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "test_id": {
            "type": "string"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_text",
      "description": "Search workspace contents for query.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "git_diff",
      "description": "Get git diff of changes.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
]
```


### Candidate: `C2_SAFE_LINE_V2`
- **Tool Schema SHA256**: `a6e766c90417875c5a9c935fd6f9b2e755008ddb1d6dc1234c01cf37d0b1fd6e`
- **Exposed Edit Function**: `edit_file`
```json
[
  {
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "Read file contents within workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          }
        },
        "required": [
          "file_path"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "edit_file",
      "description": "Edit file using safe line range patch with expected_sha256.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          },
          "expected_sha256": {
            "type": "string",
            "description": "SHA256 from read_file"
          },
          "start_line": {
            "type": "integer"
          },
          "end_line": {
            "type": "integer"
          },
          "expected_old": {
            "type": "string",
            "description": "Exact lines expected to be replaced"
          },
          "replacement": {
            "type": "string",
            "description": "New replacement lines"
          }
        },
        "required": [
          "file_path",
          "start_line",
          "end_line",
          "expected_old",
          "replacement"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_test",
      "description": "Execute unit tests in workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "test_id": {
            "type": "string"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_text",
      "description": "Search workspace contents for query.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "git_diff",
      "description": "Get git diff of changes.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
]
```


### Candidate: `E_ANCHOR`
- **Tool Schema SHA256**: `7149a7098c47a8090de1b00fe329a24c3a8b24b70e382c5a00db294c40aeeadf`
- **Exposed Edit Function**: `replace_between`
```json
[
  {
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "Read file contents within workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          }
        },
        "required": [
          "file_path"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "replace_between",
      "description": "Replace content between anchor_before and anchor_after.",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          },
          "anchor_before": {
            "type": "string"
          },
          "anchor_after": {
            "type": "string"
          },
          "replacement": {
            "type": "string"
          }
        },
        "required": [
          "file_path",
          "anchor_before",
          "anchor_after",
          "replacement"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_test",
      "description": "Execute unit tests in workspace.",
      "parameters": {
        "type": "object",
        "properties": {
          "test_id": {
            "type": "string"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_text",
      "description": "Search workspace contents for query.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "git_diff",
      "description": "Get git diff of changes.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
]
```

