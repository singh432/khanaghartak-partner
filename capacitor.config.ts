import customerConfig from './capacitor.config.customer';
import partnerConfig from './capacitor.config.partner';

const target = process.env.CAPACITOR_APP || 'customer';
export default target === 'partner' ? partnerConfig : customerConfig;
