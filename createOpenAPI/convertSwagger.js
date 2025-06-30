#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class SwaggerToOpenAPIConverter {
    constructor() {
        this.ajv = new Ajv({ allErrors: true, verbose: true });
        addFormats(this.ajv);
        this.validationErrors = [];
        this.conversionWarnings = [];
    }

    /**
     * Main conversion function
     * @param {string} inputPath - Path to input swagger.json file
     * @param {string} outputPath - Path to output openapi.json file
     */
    async convert(inputPath, outputPath) {
        try {
            console.log('🚀 Starting Swagger to OpenAPI 3.1 conversion...\n');
            
            // Validate input file exists
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }

            // Read and parse input file
            console.log(`📖 Reading input file: ${inputPath}`);
            const inputContent = fs.readFileSync(inputPath, 'utf8');
            const swaggerSpec = JSON.parse(inputContent);

            // Validate input is valid Swagger/OpenAPI
            console.log('🔍 Validating input specification...');
            await this.validateInput(swaggerSpec);

            // Convert to OpenAPI 3.1
            console.log('🔄 Converting to OpenAPI 3.1...');
            const openAPISpec = this.convertToOpenAPI31(swaggerSpec);

            // Validate output
            console.log('✅ Validating output specification...');
            await this.validateOutput(openAPISpec);

            // Write output file
            console.log(`💾 Writing output file: ${outputPath}`);
            this.ensureDirectoryExists(outputPath);
            fs.writeFileSync(outputPath, JSON.stringify(openAPISpec, null, 2));

            // Print summary
            // this.printSummary();

        } catch (error) {
            console.error('❌ Conversion failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Validate input specification
     */
    async validateInput(spec) {
        try {
            await SwaggerParser.validate(spec);
            console.log('✅ Input validation passed');
        } catch (error) {
            this.validationErrors.push({
                type: 'input',
                message: error.message,
                details: error.details || []
            });
            console.log('⚠️  Input validation warnings (continuing with conversion)');
        }
    }

    /**
     * Convert Swagger spec to OpenAPI 3.1
     */
    convertToOpenAPI31(swaggerSpec) {
        const openAPISpec = {
            openapi: "3.1.0",
            info: this.convertInfo(swaggerSpec.info),
            servers: this.convertServers(swaggerSpec.servers, swaggerSpec.host, swaggerSpec.basePath, swaggerSpec.schemes),
            paths: this.convertPaths(swaggerSpec.paths),
            components: this.convertComponents(swaggerSpec.components, swaggerSpec.definitions, swaggerSpec.parameters, swaggerSpec.responses, swaggerSpec.securityDefinitions),
            security: this.convertSecurity(swaggerSpec.security),
            tags: this.convertTags(swaggerSpec.tags),
            externalDocs: swaggerSpec.externalDocs
        };

        // Remove undefined properties
        Object.keys(openAPISpec).forEach(key => {
            if (openAPISpec[key] === undefined) {
                delete openAPISpec[key];
            }
        });

        return openAPISpec;
    }

    /**
     * Convert info object
     */
    convertInfo(info) {
        if (!info) return { title: "API", version: "1.0.0" };

        return {
            title: info.title || "API",
            version: info.version || "1.0.0",
            description: info.description,
            termsOfService: info.termsOfService,
            contact: info.contact,
            license: info.license
        };
    }

    /**
     * Convert servers configuration
     */
    convertServers(servers, host, basePath, schemes) {
        if (servers) {
            return servers.map(server => ({
                url: server.url,
                description: server.description,
                variables: server.variables
            }));
        }

        // Convert legacy host/basePath to servers
        if (host || basePath) {
            const scheme = schemes && schemes.length > 0 ? schemes[0] : 'https';
            const url = `${scheme}://${host || 'localhost'}${basePath || ''}`;
            return [{ url }];
        }

        return [{ url: "https://localhost" }];
    }

    /**
     * Convert paths
     */
    convertPaths(paths) {
        if (!paths) return {};

        const convertedPaths = {};
        
        Object.keys(paths).forEach(pathKey => {
            const pathItem = paths[pathKey];
            convertedPaths[pathKey] = {};

            // Convert operations
            ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].forEach(method => {
                if (pathItem[method]) {
                    convertedPaths[pathKey][method] = this.convertOperation(pathItem[method]);
                }
            });

            // Convert path-level parameters
            if (pathItem.parameters) {
                convertedPaths[pathKey].parameters = this.convertParameters(pathItem.parameters);
            }
        });

        return convertedPaths;
    }

    /**
     * Convert operation object
     */
    convertOperation(operation) {
        const converted = {
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags,
            externalDocs: operation.externalDocs,
            operationId: operation.operationId,
            parameters: operation.parameters ? this.convertParameters(operation.parameters) : undefined,
            requestBody: operation.requestBody ? this.convertRequestBody(operation.requestBody) : this.convertLegacyRequestBody(operation.parameters),
            responses: this.convertResponses(operation.responses),
            callbacks: operation.callbacks,
            deprecated: operation.deprecated,
            security: operation.security ? this.convertSecurity(operation.security) : undefined,
            servers: operation.servers
        };

        // Remove undefined properties
        Object.keys(converted).forEach(key => {
            if (converted[key] === undefined) {
                delete converted[key];
            }
        });

        return converted;
    }

    /**
     * Convert parameters
     */
    convertParameters(parameters) {
        if (!parameters) return [];

        return parameters.map(param => {
            // Skip body parameters as they're handled by requestBody
            if (param.in === 'body') {
                return null;
            }

            const converted = {
                name: param.name,
                in: param.in,
                description: param.description,
                required: param.required,
                deprecated: param.deprecated,
                allowEmptyValue: param.allowEmptyValue,
                style: param.style,
                explode: param.explode,
                allowReserved: param.allowReserved,
                schema: param.schema ? this.convertSchema(param.schema) : this.convertLegacyParameterSchema(param),
                example: param.example,
                examples: param.examples
            };

            // Remove undefined properties
            Object.keys(converted).forEach(key => {
                if (converted[key] === undefined) {
                    delete converted[key];
                }
            });

            return converted;
        }).filter(Boolean); // Remove null values
    }

    /**
     * Convert legacy parameter schema (Swagger 2.0 style)
     */
    convertLegacyParameterSchema(param) {
        if (param.type) {
            const schema = {
                type: param.type
            };

            // Add format if present
            if (param.format) {
                schema.format = param.format;
            }

            // Add validation rules
            if (param.minimum !== undefined) schema.minimum = param.minimum;
            if (param.maximum !== undefined) schema.maximum = param.maximum;
            if (param.minLength !== undefined) schema.minLength = param.minLength;
            if (param.maxLength !== undefined) schema.maxLength = param.maxLength;
            if (param.pattern) schema.pattern = param.pattern;
            if (param.enum) schema.enum = param.enum;
            if (param.default !== undefined) schema.default = param.default;
            if (param.multipleOf !== undefined) schema.multipleOf = param.multipleOf;
            if (param.minItems !== undefined) schema.minItems = param.minItems;
            if (param.maxItems !== undefined) schema.maxItems = param.maxItems;
            if (param.uniqueItems !== undefined) schema.uniqueItems = param.uniqueItems;

            return schema;
        }

        return undefined;
    }

    /**
     * Convert legacy request body (from body parameters)
     */
    convertLegacyRequestBody(parameters) {
        if (!parameters) return undefined;

        const bodyParam = parameters.find(param => param.in === 'body');
        if (!bodyParam) return undefined;

        return {
            description: bodyParam.description,
            content: {
                'application/json': {
                    schema: bodyParam.schema ? this.convertSchema(bodyParam.schema) : undefined
                }
            },
            required: bodyParam.required
        };
    }

    /**
     * Convert request body
     */
    convertRequestBody(requestBody) {
        if (!requestBody) return undefined;

        return {
            description: requestBody.description,
            content: this.convertContent(requestBody.content),
            required: requestBody.required
        };
    }

    /**
     * Convert responses
     */
    convertResponses(responses) {
        if (!responses) return {};

        const converted = {};
        Object.keys(responses).forEach(statusCode => {
            const response = responses[statusCode];
            converted[statusCode] = {
                description: response.description,
                headers: response.headers,
                content: response.content ? this.convertContent(response.content) : this.convertLegacyResponseContent(response),
                links: response.links
            };
        });

        return converted;
    }

    /**
     * Convert legacy response content (from schema)
     */
    convertLegacyResponseContent(response) {
        if (response.schema) {
            return {
                'application/json': {
                    schema: this.convertSchema(response.schema)
                }
            };
        }
        return undefined;
    }

    /**
     * Convert content
     */
    convertContent(content) {
        if (!content) return undefined;

        const converted = {};
        Object.keys(content).forEach(mediaType => {
            const mediaTypeObj = content[mediaType];
            converted[mediaType] = {
                schema: mediaTypeObj.schema ? this.convertSchema(mediaTypeObj.schema) : undefined,
                example: mediaTypeObj.example,
                examples: mediaTypeObj.examples,
                encoding: mediaTypeObj.encoding
            };
        });

        return converted;
    }

    /**
     * Convert schema
     */
    convertSchema(schema) {
        if (!schema) return undefined;

        // Handle references
        if (schema.$ref) {
            return { $ref: this.convertRef(schema.$ref) };
        }

        const converted = {
            type: schema.type,
            format: schema.format,
            title: schema.title,
            description: schema.description,
            default: schema.default,
            example: schema.example,
            examples: schema.examples,
            nullable: schema.nullable,
            readOnly: schema.readOnly,
            writeOnly: schema.writeOnly,
            deprecated: schema.deprecated,
            discriminator: schema.discriminator,
            xml: schema.xml,
            externalDocs: schema.externalDocs
        };

        // Handle different schema types
        if (schema.type === 'object') {
            converted.properties = schema.properties ? this.convertProperties(schema.properties) : undefined;
            converted.required = schema.required;
            converted.maxProperties = schema.maxProperties;
            converted.minProperties = schema.minProperties;
            converted.additionalProperties = schema.additionalProperties;
        } else if (schema.type === 'array') {
            converted.items = schema.items ? this.convertSchema(schema.items) : undefined;
            converted.maxItems = schema.maxItems;
            converted.minItems = schema.minItems;
            converted.uniqueItems = schema.uniqueItems;
        } else if (schema.type === 'string') {
            converted.maxLength = schema.maxLength;
            converted.minLength = schema.minLength;
            converted.pattern = schema.pattern;
            converted.enum = schema.enum;
        } else if (schema.type === 'number' || schema.type === 'integer') {
            converted.maximum = schema.maximum;
            converted.minimum = schema.minimum;
            converted.exclusiveMaximum = schema.exclusiveMaximum;
            converted.exclusiveMinimum = schema.exclusiveMinimum;
            converted.multipleOf = schema.multipleOf;
        }

        // Handle allOf, anyOf, oneOf
        if (schema.allOf) {
            converted.allOf = schema.allOf.map(s => this.convertSchema(s));
        }
        if (schema.anyOf) {
            converted.anyOf = schema.anyOf.map(s => this.convertSchema(s));
        }
        if (schema.oneOf) {
            converted.oneOf = schema.oneOf.map(s => this.convertSchema(s));
        }
        if (schema.not) {
            converted.not = this.convertSchema(schema.not);
        }

        // Remove undefined properties
        Object.keys(converted).forEach(key => {
            if (converted[key] === undefined) {
                delete converted[key];
            }
        });

        return converted;
    }

    /**
     * Convert properties
     */
    convertProperties(properties) {
        if (!properties) return undefined;

        const converted = {};
        Object.keys(properties).forEach(propName => {
            converted[propName] = this.convertSchema(properties[propName]);
        });

        return converted;
    }

    /**
     * Convert components
     */
    convertComponents(components, definitions, parameters, responses, securityDefinitions) {
        const converted = {};

        // Convert schemas
        if (components && components.schemas) {
            converted.schemas = this.convertSchemas(components.schemas);
        } else if (definitions) {
            converted.schemas = this.convertSchemas(definitions);
        }

        // Convert parameters
        if (components && components.parameters) {
            converted.parameters = this.convertParameterDefinitions(components.parameters);
        } else if (parameters) {
            converted.parameters = this.convertParameterDefinitions(parameters);
        }

        // Convert responses
        if (components && components.responses) {
            converted.responses = this.convertResponseDefinitions(components.responses);
        } else if (responses) {
            converted.responses = this.convertResponseDefinitions(responses);
        }

        // Convert security schemes
        if (components && components.securitySchemes) {
            converted.securitySchemes = this.convertSecuritySchemes(components.securitySchemes);
        } else if (securityDefinitions) {
            converted.securitySchemes = this.convertSecuritySchemes(securityDefinitions);
        }

        // Convert other components
        if (components) {
            if (components.examples) converted.examples = components.examples;
            if (components.requestBodies) converted.requestBodies = components.requestBodies;
            if (components.headers) converted.headers = components.headers;
            if (components.links) converted.links = components.links;
            if (components.callbacks) converted.callbacks = components.callbacks;
        }

        return Object.keys(converted).length > 0 ? converted : undefined;
    }

    /**
     * Convert schemas
     */
    convertSchemas(schemas) {
        if (!schemas) return undefined;

        const converted = {};
        Object.keys(schemas).forEach(schemaName => {
            converted[schemaName] = this.convertSchema(schemas[schemaName]);
        });

        return converted;
    }

    /**
     * Convert parameter definitions
     */
    convertParameterDefinitions(parameters) {
        if (!parameters) return undefined;

        const converted = {};
        Object.keys(parameters).forEach(paramName => {
            const param = parameters[paramName];
            if (param.in !== 'body') { // Skip body parameters
                converted[paramName] = this.convertParameters([param])[0];
            }
        });

        return converted;
    }

    /**
     * Convert response definitions
     */
    convertResponseDefinitions(responses) {
        if (!responses) return undefined;

        const converted = {};
        Object.keys(responses).forEach(responseName => {
            converted[responseName] = this.convertResponses({ [responseName]: responses[responseName] })[responseName];
        });

        return converted;
    }

    /**
     * Convert security schemes
     */
    convertSecuritySchemes(securitySchemes) {
        if (!securitySchemes) return undefined;

        const converted = {};
        Object.keys(securitySchemes).forEach(schemeName => {
            const scheme = securitySchemes[schemeName];
            
            // Convert based on type
            if (scheme.type === 'http') {
                converted[schemeName] = {
                    type: 'http',
                    scheme: scheme.scheme,
                    bearerFormat: scheme.bearerFormat,
                    description: scheme.description
                };
            } else if (scheme.type === 'apiKey') {
                converted[schemeName] = {
                    type: 'apiKey',
                    name: scheme.name,
                    in: scheme.in,
                    description: scheme.description
                };
            } else if (scheme.type === 'oauth2') {
                converted[schemeName] = {
                    type: 'oauth2',
                    flows: scheme.flows,
                    description: scheme.description
                };
            } else if (scheme.type === 'openIdConnect') {
                converted[schemeName] = {
                    type: 'openIdConnect',
                    openIdConnectUrl: scheme.openIdConnectUrl,
                    description: scheme.description
                };
            } else {
                // Handle legacy bearer token format
                if (scheme.name === 'Authorization' && scheme.in === 'header') {
                    converted[schemeName] = {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: scheme.description
                    };
                } else {
                    converted[schemeName] = {
                        type: 'apiKey',
                        name: scheme.name,
                        in: scheme.in,
                        description: scheme.description
                    };
                }
            }
        });

        return converted;
    }

    /**
     * Convert security
     */
    convertSecurity(security) {
        if (!security) return undefined;

        return security.map(sec => {
            const converted = {};
            Object.keys(sec).forEach(key => {
                converted[key] = sec[key];
            });
            return converted;
        });
    }

    /**
     * Convert tags
     */
    convertTags(tags) {
        if (!tags) return undefined;

        return tags.map(tag => ({
            name: tag.name,
            description: tag.description,
            externalDocs: tag.externalDocs
        }));
    }

    /**
     * Convert reference
     */
    convertRef(ref) {
        // Convert Swagger 2.0 refs to OpenAPI 3.1 refs
        if (ref.startsWith('#/definitions/')) {
            return ref.replace('#/definitions/', '#/components/schemas/');
        }
        if (ref.startsWith('#/parameters/')) {
            return ref.replace('#/parameters/', '#/components/parameters/');
        }
        if (ref.startsWith('#/responses/')) {
            return ref.replace('#/responses/', '#/components/responses/');
        }
        if (ref.startsWith('#/securityDefinitions/')) {
            return ref.replace('#/securityDefinitions/', '#/components/securitySchemes/');
        }
        return ref;
    }

    /**
     * Validate output specification
     */
    async validateOutput(spec) {
        try {
            await SwaggerParser.validate(spec);
            console.log('✅ Output validation passed');
        } catch (error) {
            this.validationErrors.push({
                type: 'output',
                message: error.message,
                details: error.details || []
            });
            console.log('⚠️  Output validation warnings');
        }
    }

    /**
     * Ensure directory exists for output file
     */
    ensureDirectoryExists(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Print conversion summary
     */
    printSummary() {
        console.log('\n📊 Conversion Summary:');
        console.log('=====================');
        
        if (this.validationErrors.length > 0) {
            console.log('\n❌ Validation Errors:');
            this.validationErrors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.type.toUpperCase()} - ${error.message}`);
                if (error.details && error.details.length > 0) {
                    error.details.forEach(detail => {
                        console.log(`   - ${detail.message}`);
                    });
                }
            });
        }

        if (this.conversionWarnings.length > 0) {
            console.log('\n⚠️  Conversion Warnings:');
            this.conversionWarnings.forEach((warning, index) => {
                console.log(`${index + 1}. ${warning}`);
            });
        }

        if (this.validationErrors.length === 0 && this.conversionWarnings.length === 0) {
            console.log('✅ Conversion completed successfully with no issues!');
        } else {
            console.log('\n💡 Recommendations:');
            console.log('- Review the validation errors and warnings above');
            console.log('- Update your OpenAPI specification to address any issues');
            console.log('- Test the converted specification with your API tools');
        }

        console.log('\n🎉 Conversion process completed!');
    }
}

// CLI interface
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node convertSwagger.js <input-file> <output-file>');
        console.log('');
        console.log('Examples:');
        console.log('  node convertSwagger.js swagger.json openapi.json');
        console.log('  node convertSwagger.js ./api/swagger.json ./output/openapi.json');
        console.log('');
        console.log('The script will:');
        console.log('1. Read the input Swagger/OpenAPI specification');
        console.log('2. Convert it to OpenAPI 3.1 format');
        console.log('3. Validate the output');
        console.log('4. Write the converted specification to the output file');
        console.log('5. Display any validation errors or warnings');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputFile = args[1];

    const converter = new SwaggerToOpenAPIConverter();
    converter.convert(inputFile, outputFile);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SwaggerToOpenAPIConverter;
