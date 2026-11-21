class ContactValidationService {
  constructor() {
    this.requireValidation = process.env.REQUIRE_CONTACT_VALIDATION === 'true';
    this.whitelist = this.parseWhitelist(process.env.WHITELIST_NUMBERS || '');
  }

  parseWhitelist(whitelistStr) {
    if (!whitelistStr) return [];
    return whitelistStr.split(',').map(n => this.normalizePhone(n.trim()));
  }

  normalizePhone(phone) {
    return phone.replace(/[^0-9]/g, '');
  }

  isValidContact(phone) {
    if (!this.requireValidation) return true;
    if (this.whitelist.length === 0) return true;
    
    const normalized = this.normalizePhone(phone);
    return this.whitelist.some(w => normalized.includes(w));
  }

  addToWhitelist(phone) {
    const normalized = this.normalizePhone(phone);
    if (!this.whitelist.includes(normalized)) {
      this.whitelist.push(normalized);
    }
  }

  removeFromWhitelist(phone) {
    const normalized = this.normalizePhone(phone);
    this.whitelist = this.whitelist.filter(w => w !== normalized);
  }

  getWhitelist() {
    return [...this.whitelist];
  }
}

export default new ContactValidationService();