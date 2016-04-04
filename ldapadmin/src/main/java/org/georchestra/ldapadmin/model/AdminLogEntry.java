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

package org.georchestra.ldapadmin.model;

import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.security.ldap.userdetails.Person;

import javax.persistence.*;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(schema = "ldapadmin", name = "admin_log")
@NamedQuery(name = "AdminLogEntry.findByTargetPageable", query = "SELECT l FROM AdminLogEntry l WHERE l.target = :target ORDER BY l.date")
public class AdminLogEntry {

    @Id
    @SequenceGenerator(name="admin_log_seq", schema = "ldapadmin", sequenceName="admin_log_seq", initialValue=1, allocationSize=1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "admin_log_seq")
    private long id;
    private UUID admin;
    private UUID target;
    private AdminLogType type;

    @Column(updatable = false, nullable = false)
    private Date date;

    public AdminLogEntry() {}

    public AdminLogEntry(UUID admin, UUID target, AdminLogType type, Date date) {
        this.admin = admin;
        this.target = target;
        this.type = type;
        this.date = date;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public UUID getAdmin() {
        return admin;
    }

    public void setAdmin(UUID admin) {
        this.admin = admin;
    }

    public UUID getTarget() {
        return target;
    }

    public void setTarget(UUID target) {
        this.target = target;
    }

    public AdminLogType getType() {
        return type;
    }

    public void setType(AdminLogType type) {
        this.type = type;
    }

    public Date getDate() {
        return date;
    }

    public void setDate(Date date) {
        this.date = date;
    }

    public JSONObject toJSON() throws JSONException {
        JSONObject res = new JSONObject();
        res.put("admin", this.admin.toString());
        res.put("target", this.target.toString());
        res.put("type", this.type.toString());
        res.put("date", this.date.toString());
        return res;
    }
}
