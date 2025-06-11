import { IObject } from './types';
declare class ConfigurationProvider {
    private secrets;
    private fromAwsSecretsManager;
    private awsSecretName;
    static getSecret: (secretName: string) => Promise<IObject>;
    static getMultiSecrets: (secrets: string) => Promise<IObject>;
    initialize: ({ fromAwsSecretsManager, awsSecretName, }: {
        fromAwsSecretsManager: boolean;
        awsSecretName?: string;
    }) => Promise<void>;
    refresh: () => Promise<void>;
    fetchSecrets: () => Promise<void>;
    getValue: (key: string) => string | undefined;
    getRequiredValue: (key: string) => string;
    getUpdatedValue: (key: string, required: boolean) => Promise<string | undefined>;
    setValue: (secretKey: string, secretValue: string, throwErrorIfFailed: boolean) => Promise<void>;
}
export declare const configurationProvider: ConfigurationProvider;
export {};
//# sourceMappingURL=configuration_provider.d.ts.map