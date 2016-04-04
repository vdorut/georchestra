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

package org.georchestra.mapfishapp.ws.upload;


/**
 * <p>
 * This exception is used to break the SAX parsing process, which explore the document in order to identify its version. 
 * Thus if the version is found in the kml document. 
 * the rest of document is ignored.
 * </p>
 * @author Mauricio Pazos
 *
 */
 final class FundKMLVersionException extends Exception{

    /**
     * 
     */
    private static final long serialVersionUID = -7708515311150341495L;

}
