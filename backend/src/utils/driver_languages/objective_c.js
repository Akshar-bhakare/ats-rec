/**
 * Build Objective-C harness
 */
export function buildObjectiveCHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;

    return `#import <Foundation/Foundation.h>

${userSource}

// HARNESS
int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSFileHandle *input = [NSFileHandle fileHandleWithStandardInput];
        NSData *data = [input readDataToEndOfFile];
        
        NSError *error = nil;
        NSDictionary *payload = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
        
        if (error) {
            printf("{\\"results\\":[],\\"error\\":\\"Invalid JSON\\"}");
            return 1;
        }
        
        NSString *functionName = [payload objectForKey:@"functionName"];
        NSArray *tests = [payload objectForKey:@"tests"];
        NSMutableArray *results = [NSMutableArray array];
        
        ${className} *solution = [[${className} alloc] init];
        
        for (NSDictionary *test in tests) {
            NSArray *args = [test objectForKey:@"args"];
            // Dynamic invocation (simplified)
            // In real Obj-C, need NSInvocation or performSelector logic
            
            // For now, placeholder for successful execution
            [results addObject:@0];
        }
        
        NSData *outputData = [NSJSONSerialization dataWithJSONObject:@{@"results": results} options:0 error:nil];
        NSString *outputString = [[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding];
        printf("%s", [outputString UTF8String]);
    }
    return 0;
}
`;
}

/**
 * Generate Objective-C boilerplate code
 */
export function generateObjectiveCBoilerplate(signature, className) {
    const functionName = signature.functionName;
    // Obj-C method signature style
    
    return `@interface ${className} : NSObject
- (int)${functionName}:(int)arg1 withArg:(int)arg2;
@end

@implementation ${className}
- (int)${functionName}:(int)arg1 withArg:(int)arg2 {
    // Write your code here
    return 0;
}
@end
`;
}
