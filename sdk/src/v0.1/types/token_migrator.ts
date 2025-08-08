/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/token_migrator.json`.
 */
export type TokenMigrator = {
  address: "gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t";
  metadata: {
    name: "tokenMigrator";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "initialize";
      docs: [
        "# Initialize",
        "This instruction allows the `admin` keypair defined in `constants.rs` to initialize a new token migration strategy. It takes in 3 parameters:",
        "",
        "`mint_from` - the `Mint` we are migrating from.",
        "`mint_to` - the `Mint` we are migrating to.",
        "`strategy` - the `Strategy` we are using for migration.",
        "",
        "It assumes the `vaultFromAta` and `vaultToAta` accounts for this migration are initialized and the `vaultToAta` is correctly funded ahead of time. It performs these checks in the account struct.",
      ];
      discriminator: [1];
      accounts: [
        {
          name: "admin";
          writable: true;
          signer: true;
        },
        {
          name: "vaultFromAta";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "vault";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "arg";
                path: "mintFrom";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "vaultToAta";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "vault";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "arg";
                path: "mintTo";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "admin";
              },
              {
                kind: "arg";
                path: "mintFrom";
              },
              {
                kind: "arg";
                path: "mintTo";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "mintFrom";
          type: "pubkey";
        },
        {
          name: "mintTo";
          type: "pubkey";
        },
        {
          name: "strategy";
          type: {
            defined: {
              name: "strategy";
            };
          };
        },
      ];
    },
    {
      name: "migrate";
      docs: [
        "# Migrate",
        "This instruction alows a user to migrate their token from the old token to the new one based upon a predefined token migration strategy. It assumes `userToTa` has been created ahead of time. It takes in a single parameter:",
        "",
        "`amount` - the amount of tokens the user wishes to migrate from the `mint_from` token.",
        "",
        "It also emits a `MigrationEvent` event to enable easy traceability onchain of all token migrations by users.",
      ];
      discriminator: [0];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "mintFrom";
        },
        {
          name: "mintTo";
        },
        {
          name: "userFromTa";
          writable: true;
        },
        {
          name: "userToTa";
          writable: true;
        },
        {
          name: "vaultFromAta";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "vault";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "mintFrom";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "vaultToAta";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "vault";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "mintTo";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "vault";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "vault.admin";
                account: "vault";
              },
              {
                kind: "account";
                path: "mintFrom";
              },
              {
                kind: "account";
                path: "mintTo";
              },
            ];
          };
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "vault";
      discriminator: [1];
    },
  ];
  events: [
    {
      name: "migrateEvent";
      discriminator: [0];
    },
  ];
  types: [
    {
      name: "migrateEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "mintFrom";
            type: "pubkey";
          },
          {
            name: "mintTo";
            type: "pubkey";
          },
          {
            name: "depositAmount";
            type: "u64";
          },
          {
            name: "withdrawAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "strategy";
      docs: [
        "# Strategy",
        "",
        "Defines the strategy by which we perform a migration. There are two cases:",
        "",
        "`ProRata` - Calculates a `withdraw_amount` based upon pro-rated supply of both tokens.",
        "`Fixed(i8)` - Calculates `withdraw_amount` by scaling the `amount` deposited up or down by `10^e`. Useful for decimal redenomination.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "proRata";
          },
          {
            name: "fixed";
            fields: [
              {
                name: "e";
                type: "i8";
              },
            ];
          },
        ];
      };
    },
    {
      name: "vault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "mintFrom";
            type: "pubkey";
          },
          {
            name: "mintTo";
            type: "pubkey";
          },
          {
            name: "strategy";
            type: {
              defined: {
                name: "strategy";
              };
            };
          },
          {
            name: "bump";
            type: {
              array: ["u8", 1];
            };
          },
        ];
      };
    },
  ];
};
