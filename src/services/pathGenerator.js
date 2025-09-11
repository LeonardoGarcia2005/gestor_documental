import { getAllActiveRules } from '../dataAccessObjects/routeRuleDAO';
import { getById } from '../dataAccessObjects/routeParameterDAO';
import { getParametersByRuleId } from '../dataAccessObjects/routeRuleParameterDAO';

const findMatchingRule = (rules, { security, company }) => {
    return rules
        .sort((a, b) => a.priority - b.priority)
        .find(rule => 
            rule.security_level_type === security && 
            (!rule.company_required || company)
        );
};

const buildPath = async (rule, params) => {
    const ruleParams = await getParametersByRuleId(rule.id);
    const sortedParams = [...ruleParams].sort((a, b) => a.position_order - b.position_order);
    
    const pathParts = await Promise.all(
        sortedParams.map(async ({ route_parameter_id, default_value }) => {
            const param = await getById(route_parameter_id);
            const paramKey = param.parameter_key.replace(/[{}]/g, '');
            return params[paramKey] || default_value;
        })
    );
    
    return pathParts.filter(Boolean).join(rule.separator_char || '/');
};

const generatePath = async (params) => {
    const rules = await getAllActiveRules();
    const matchingRule = findMatchingRule(rules, params);
    
    if (!matchingRule) {
        throw new Error('No matching routing rule found for the given parameters');
    }
    
    return buildPath(matchingRule, {
        ...params,
        security: params.security,
        company: params.company || 'sin_empresa'
    });
};

export default { generatePath };
