/*
 * Copyright (C) 2009-2016 by the geOrchestra PSC
 *
 * This file is part of geOrchestra.
 *
 * geOrchestra is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * geOrchestra is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * geOrchestra.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.georchestra.ldapadmin.ws.utils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.util.StringUtils;
import org.springframework.validation.Errors;

/**
 * Validation class for all forms
 *
 * @author Sylvain Lesage
 *
 */
public class Validation {

	private static List<String> requiredFields;
	public String getRequiredFields() {
		return requiredFields.toString();
	}
	public void setRequiredFields(String csvRequiredFields) {
		List<String> r = new ArrayList<String>(Arrays.asList(csvRequiredFields.split("\\s*,\\s*")));
		// add mandatory fields (they may be present two times, it's not a problem)
		r.add("email");
		r.add("uid");
		r.add("password");
		r.add("confirmPassword");
		this.requiredFields = r;
	}
	public static boolean isFieldRequired (String field) {
	    if (requiredFields == null)
	        return false;

		for (String f : requiredFields) {
			if (field.equals(f)) {
				return true;
			}
		}
		return false;
	}
	public static void validateField (String field, String value, Errors errors) {
		if( Validation.isFieldRequired(field) && !StringUtils.hasLength(value) ){
			errors.rejectValue(field, "error.required", "required");
		}
	}
}
