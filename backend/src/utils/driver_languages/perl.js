/**
 * Build Perl harness
 * Dependency-free
 */
export function buildPerlHarness(userSource, signature) {
    const functionName = signature.functionName;
    return `use strict;
use warnings;
use feature 'signatures';
no warnings 'experimental::signatures';
use JSON::PP;

${userSource}

# HARNESS
local $/;
my $json_text = <STDIN>;

if (!defined $json_text || length($json_text) == 0) {
    print '{"results":[], "error": "Empty stdin"}';
    exit;
}

# Parse JSON input
my $input_data;
eval {
    $input_data = decode_json($json_text);
};
if ($@) {
    print '{"results":[], "error": "Invalid JSON format"}';
    exit;
}

my $tests = $input_data->{tests};
my @results;

foreach my $test (@$tests) {
    my $args = $test->{args};
    
    # Call user function dynamically
    # Use eval to handle potential runtime errors gracefully
    my $res;
    eval {
        $res = main::${functionName}(@$args);
    };
    if ($@) {
        # If error, return it as part of result or handle it
        # For now, simplistic handling (could be improved)
        $res = "Error: $@";
    }
    
    # Ensure result is formatted appropriately for JSON
    push @results, $res;
}

# Encode results back to JSON
print encode_json({ results => \\@results });
`;
}

/**
 * Generate Perl boilerplate code
 */
export function generatePerlBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramList = params.map(p => `$${p.name}`).join(', ');
    
    return `use feature 'signatures';
no warnings 'experimental::signatures';

sub ${functionName} {
    my (${paramList}) = @_;
    # Write your code here
    
}
`;
}
